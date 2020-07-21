const AWS = require('aws-sdk');
AWS.config.update({ region: 'ap-northeast-1' });

module.exports.writeDb = function (name, text) {
  // Create the DynamoDB service object
  const ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10' });

  const params = {
    TableName: 'LINE-BOT-DB',
    Item: {
      'Name': { S: name },
      'Text': { S: text },
    },
  };

  return new Promise((resolve, reject) => {
    // Call DynamoDB to add the item to the table
    ddb.putItem(params, function (err, data) {
      if (err) {
        console.log('Error', err);
        resolve(err);
      } else {
        console.log('Success', data);
        resolve(data);
      }
    });
  });
}