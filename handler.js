"use strict";

const line = require("@line/bot-sdk");
const OpenAI = require('openai');
const crypto = require("crypto");
const request = require("request");
const Log = require("@dazn/lambda-powertools-logger");
const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");
const { DynamoDBClient, PutItemCommand, QueryCommand } = require("@aws-sdk/client-dynamodb");

// クライアントの初期化 (両方の方法で共通)
const dynamodb = new DynamoDBClient({ 
  region: "ap-northeast-1" 
});

const lineClient = new line.Client({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
});

const bedrockClient = new BedrockRuntimeClient({
  region: "us-east-1",
});

function generateResponse(statusCode, lineStatus, message) {
  return {
    statusCode: statusCode,
    headers: { "X-Line-Status": lineStatus },
    body: `{"result":"${message}"}`,
  };
}

const validateSignature = (event) => {
  const signature = event.headers["X-Line-Signature"];
  const body = event.body;
  const hash = crypto
    .createHmac("sha256", process.env.CHANNEL_SECRET)
    .update(body)
    .digest("base64");
  return hash === signature;
};

function isLineConnectionError(replyToken, context) {
  if (replyToken !== "00000000000000000000000000000000") return false;
  // 接続確認エラー回避
  context.succeed(generateResponse(200, "OK", "connect check"));
  return true;
}

async function getUserProfile(userId) {
  try {
    const profile = await lineClient.getProfile(userId);
    return profile;
  } catch (error) {
    console.error(`Get profile error: ${error}`);
    return null;
  }
}

async function saveConversation(userId, userMessage, aiMessage) {
  try {
    const command = new PutItemCommand({
      TableName: process.env.DYNAMODB_TABLE,
      Item: {
        userId: { S: userId },
        timestamp: { N: Date.now().toString() },
        userMessage: { S: userMessage },
        aiMessage: { S: aiMessage }
      }
    });
    const response = await dynamodb.send(command);
    Log.info('Conversation saved successfully', { data: response });
  } catch (error) {
    console.error('Error saving conversation:', error);
  }
}

async function getConversationHistory(userId, limit = 5) {
  try {
    const params = {
      TableName: process.env.DYNAMODB_TABLE,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": { S: userId },
      },
      Limit: limit,
      ScanIndexForward: false,
    };
    const command = new QueryCommand(params);
    const response = await dynamodb.send(command);
    Log.info('Conversation history retrieved successfully', { data: response.Items });

    return response.Items;
  } catch (error) {
    console.error('Error getting conversation history:', error);
    return [];
  }
}

async function replyMessage(replyToken, message) {
  try {
    const result = await lineClient.replyMessage(replyToken, message);
    return result;
  } catch (error) {
    console.error(`Get profile error: ${error}`);
    return null;
  }
}

// open ai に画像を送信して説明を取得
async function getImageDescription(image_url) {
  // 初期化
  const openai = new OpenAI();

  const response = await openai.chat.completions.create({
    model: "gpt-4o-2024-05-13",
    max_tokens: 4096,
    prompt: "あなたは画像を見ています。画像について説明してください。",
    messages: [
      {
        role: "user",
        content: [
          { 
            type: "text", 
            text: "この画像について説明してください。"
          },
          {
            type: "image_url",
            image_url: {
              "url": image_url,
            },
          },
        ],
      },
    ],
  });
  return response.choices[0]["message"]["content"];
}

// 引数にpromptのテキストを指定する
async function invokeBedrock(prompt, history) {
  // 過去の会話の履歴を取得
  let conversationHistory = [];
  for (const item of history) {
    conversationHistory.push({
      role: "user",
      content: [
        {
          type: "text",
          text: item.userMessage.S,
        },
      ],
    });
    conversationHistory.push({
      role: "assistant",
      content: [
        {
          type: "text",
          text: item.aiMessage.S,
        },
      ],
    });
  }
  Log.info("会話履歴", { data: conversationHistory });
  // 新しいメッセージを追加
  const newMessage = {
    role: "user",
    content: [
      {
        type: "text",
        text: prompt,
      },
    ],
  }
  // 会話履歴と新しいメッセージを結合
  conversationHistory.push(newMessage);
  
  const params = {
    modelId: "anthropic.claude-3-5-sonnet-20240620-v1:0", // 使用したいモデルIDを指定
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 8192,
      messages:  conversationHistory
    }),
  };

  try {
    const command = new InvokeModelCommand(params);
    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    console.log("Bedrock response content:", responseBody.content);
    console.log("Bedrock response text:", responseBody.content[0].text);
    return responseBody.content[0].text;
  } catch (error) {
    console.error("Error invoking Bedrock:", error);
    return "エラーが発生しました。";
  }
}

module.exports.hello = async (event, context) => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Hello World!",
    }),
  };
}

module.exports.callback = async (event, context) => {
  const body = JSON.parse(event.body);

  const userId = body.events[0].source.userId;
  const text = body.events[0].message.text;
  const replyToken = body.events[0].replyToken;

  // もし送信されたテキストがURLじゃない場合は固定のメッセージを返す
  // if (!text.match(/https?:\/\/\S+/)) {
  //   const message = {
  //     type: "text",
  //     text: "画像URLを送信してください。",
  //   };
  //   Log.info("メッセージデータ", { data: message });

  //   const messageResult = await replyMessage(replyToken, message);
  //   Log.info("送信結果", { data: messageResult });
  //   return;
  // }

  // 画像のURL
  // const ai_message = await getImageDescription(image_url);

  const history = await getConversationHistory(userId);

  const aiResponse = await invokeBedrock(text, history);
  Log.info("AIの返答", { data: aiResponse });

  const message = {
    type: "text",
    text: aiResponse,
  };
  Log.info("ユーザID", { data: userId, text: text, data: aiResponse });

  const result = await saveConversation(userId, text, aiResponse);
  Log.info("保存結果", { data: result });

  const messageResult = await replyMessage(replyToken, message);
  Log.info("送信結果", { data: messageResult });
};
