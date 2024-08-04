"use strict";

const line = require("@line/bot-sdk");
const OpenAI = require('openai');
const crypto = require("crypto");
const request = require("request");
const Log = require("@dazn/lambda-powertools-logger");

// Bedrock Runtime SDK と DynamoDB SDK をインポート
const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");
const { DynamoDBClient, PutItemCommand, QueryCommand } = require("@aws-sdk/client-dynamodb");
// S3 SDK をインポート
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const fs = require('fs').promises;
const os = require('os');
const path = require('path');

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
  // history を逆順にする(時系列で並べるため)
  history.reverse();

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

async function invokeBedrockWithImage(imagePath) {
  const image = await fs.readFile(imagePath);
  const binaryData = Buffer.from(image).toString('base64');

  const messages = [
    {
      role: "user", 
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/jpeg",
            data: binaryData
          }
        },
        { 
          type: "text",
          text: "画像について何が書かれているか日本語で返答せよ。"
        }
      ]
    }
  ];

  const params = {
    modelId: "anthropic.claude-3-5-sonnet-20240620-v1:0", // 使用したいモデルIDを指定
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 8192,
      messages: messages
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
  // 非同期処理を開始
  await processAsyncTask(event)
    .then(() => console.log('Async task completed'))
    .catch(err => console.error('Async task failed:', err));

  // 即座に応答を返す
  return {
    statusCode: 202,
    body: JSON.stringify({ message: 'Task accepted and processing' }),
  };
};

async function processAsyncTask(event) {
  Log.info("Event", { event });

  const body = event.body;
  const userId = body.events[0].source.userId;
  let text = body.events[0].message.text;
  const replyToken = body.events[0].replyToken;

  let aiResponse = ''
  if (body.events[0].message.type === "image") {
    const imageId = body.events[0].message.id;
    const imageObj = await getImage(imageId);
    Log.info("画像の取得", { data: imageObj });
    aiResponse = await invokeBedrockWithImage(imageObj.filePath);
    text = '画像について説明してください。:' + imageObj.s3Url;
  } else if (body.events[0].message.type === "text") {
    const history = await getConversationHistory(userId);
    aiResponse = await invokeBedrock(text, history);
  }

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
}

async function getImage(messageId) {
  try {
    // 画像のバイナリデータを取得
    const stream = await lineClient.getMessageContent(messageId);
    
    // バイナリデータをバッファに変換
    let chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    Log.info('画像の取得に成功しました:', { data: buffer });
    
    const tempFilename = `image_${Date.now()}.jpg`;
    const tempFileObj = await saveImageTemporarily(buffer, tempFilename);

    return tempFileObj;
  } catch (error) {
    console.error('画像の取得に失敗しました:', error);
    return lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: '画像の処理中にエラーが発生しました。'
    });
  }
}

async function saveImageTemporarily(imageBuffer, filename) {
  const tempDir = os.tmpdir();
  const filePath = path.join(tempDir, filename);
  
  try {
    await fs.writeFile(filePath, imageBuffer);
    Log.info('画像を一時保存しました', { filePath });

    // s3に画像をアップロード
    const s3Key = `images/${filename}`;
    const s3Url = await uploadImageToS3(filePath, s3Key);
    Log.info('S3に画像をアップロードしました', { s3Url });

    return { 
      filePath,
      s3Url
    };
  } catch (error) {
    console.error('Error saving image:', error);
    throw error;
  }
}

async function uploadImageToS3(filePath, s3Key) {
  const s3 = new S3Client({ region: 'ap-northeast-1' });
  const bucketName = process.env.S3_BUCKET;

  if (!bucketName) {
    throw new Error('S3_BUCKET environment variable is not set');
  }

  try {
    const fileContent = await fs.readFile(filePath);

    const params = {
      Bucket: bucketName,
      Key: s3Key,
      Body: fileContent,
      ContentType: 'image/jpeg' // 適切なContent-Typeに変更してください
    };

    const command = new PutObjectCommand(params);
    const response = await s3.send(command);

    console.log(`Image uploaded successfully. ETag: ${response.ETag}`);
    const region = await s3.config.region();

    return `https://${bucketName}.s3.${region}.amazonaws.com/${s3Key}`;
  } catch (error) {
    console.error('Error uploading image to S3:', error);
    throw error;
  }
}
