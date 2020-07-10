# Serverless LINE BOT

## Structure

## Use-cases

## Setup

```bash
$ npm install serverless -g
```

```bash
$ git clone https://github.com/x-hack-git/serverless-line-bot.git
$ cd serverless-line-bot
$ npm install
```

## Set Environment

Edit serverless.yml

```yml
CHANNEL_ACCESS_TOKEN: "YOUR LINE CHANNEL ACCESS TOKEN"
CHANNEL_SECRET: "YOUR LINE CHANNEL ACCESS TOKEN"
```

## Deploy

In order to deploy the endpoint simply run

```bash
$ serverless deploy
```

The expected result should be similar to:

```bash
Serverless: Packaging service...
Serverless: Excluding development dependencies...
Serverless: Uploading CloudFormation file to S3...
Serverless: Uploading artifacts...
Serverless: Uploading service aws-node-line-bot.zip file to S3 (2.04 MB)...
Serverless: Validating template...
Serverless: Updating Stack...
Serverless: Checking Stack update progress...
..............
Serverless: Stack update finished...
Service Information
service: aws-node-line-bot
stage: dev
region: ap-northeast-1
stack: aws-node-line-bot-dev
resources: 12
api keys:
  None
endpoints:
  POST - https://amea7hwl28.execute-api.ap-northeast-1.amazonaws.com/dev/callback
functions:
  bot: aws-node-line-bot-dev-bot
layers:
  None
Serverless: Removing old service artifacts from S3...
Serverless: Run the "serverless" command to setup monitoring, troubleshooting and testing.
```

## Set Callback URL

Endpoint URL https://example.region.amazonaws.com/stage/callback

## Usage

## Scaling

### AWS Lambda

By default, AWS Lambda limits the total concurrent executions across all functions within a given region to 100. The default limit is a safety limit that protects you from costs due to potential runaway or recursive functions during initial development and testing. To increase this limit above the default, follow the steps in [To request a limit increase for concurrent executions](http://docs.aws.amazon.com/lambda/latest/dg/concurrent-executions.html#increase-concurrent-executions-limit).
