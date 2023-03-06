"use strict";

const line = require("@line/bot-sdk");
const crypto = require("crypto");
const request = require("request");
const Log = require("@dazn/lambda-powertools-logger");

const client = new line.Client({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
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
    const profile = await client.getProfile(userId);
    return profile;
  } catch (error) {
    console.error(`Get profile error: ${error}`);
    return null;
  }
}

async function replyMessage(replyToken, message) {
  try {
    const result = await client.replyMessage(replyToken, message);
    return result;
  } catch (error) {
    console.error(`Get profile error: ${error}`);
    return null;
  }
}

module.exports.callback = async (event, context) => {
  const body = JSON.parse(event.body);

  Log.info("検証", { event });

  const userId = body.events[0].source.userId;
  const text = body.events[0].message.text;
  const replyToken = body.events[0].replyToken;

  // if (!validateSignature(event)) return;
  // if (isLineConnectionError(replyToken, context)) return;

  const userProfile = await getUserProfile(userId);
  Log.info("ユーザープロフィール", { userProfile });

  const message = {
    type: "text",
    text: "hello!!" + userProfile.displayName + "さん\n" + text,
  };
  Log.info("メッセージデータ", { data: message });

  const messageResult = await replyMessage(replyToken, message);
  Log.info("送信結果", { data: messageResult });
};
