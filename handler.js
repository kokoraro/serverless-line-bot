'use strict';

const line = require('@line/bot-sdk');
const crypto = require('crypto');
const request = require('request');

const client = new line.Client({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
});

function generateResponse(statusCode, lineStatus, message) {
  return {
    statusCode: statusCode,
    headers: { "X-Line-Status": lineStatus},
    body: `{"result":"${message}"}`
  };
}

function validateSignature(event) {
  let signature = crypto.createHmac('sha256', process.env.CHANNEL_SECRET).update(event.body).digest('base64');
  let checkHeader = (event.headers || {})['X-Line-Signature'];
  return signature === checkHeader;
}

function IsLineConnectionError(replyToken, context) {
  if (replyToken !== '00000000000000000000000000000000') return false;
  //接続確認エラー回避
  context.succeed(generateResponse(200, "OK", "connect check"));
  return true;
}

function getUserProfile(user_id) {
  return {
    url: 'https://api.line.me/v2/bot/profile/' + user_id,
    json: true,
    headers: {
      'Authorization': 'Bearer {' + process.env.CHANNEL_ACCESS_TOKEN + '}'
    }
  };
}

module.exports.callback = function (event, context) {
  const body = JSON.parse(event.body);
  const userId = body.events[0].source.userId;
  const text = body.events[0].message.text;
  const replyToken = body.events[0].replyToken;

  if (!validateSignature(event)) return;
  if (IsLineConnectionError(replyToken, context)) return;

  request.get(getUserProfile(userId), function (error, response, body) {
    if (error || response.statusCode != 200) return;

    const message = {
      'type': 'text',
      'text': "hello!!" + body.displayName + "さん\n" + text
    };

    client.replyMessage(replyToken, message)
      // eslint-disable-next-line no-unused-vars
      .then((response) => {
        context.succeed(generateResponse(200, "OK", "complete"));
      })
      .catch((err) => console.log(err));
  });
};
