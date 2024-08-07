# Serverless LINE BOT

## Structure

## Use-cases

## Setup

```bash
$ git clone https://github.com/x-hack-git/serverless-line-bot.git
$ cd serverless-line-bot
$ yarn
```

## AWS Credentialsの設定手順

1. AWS CLIのインストール:
   まだAWS CLIをインストールしていない場合は、公式ドキュメントに従ってインストールしてください。

2. `aws configure` コマンドの実行:
  ターミナルで以下のコマンドを実行します：
  ```bash
  $ aws configure
  ```

3. プロンプトに従って情報を入力:
  ```
  AWS Access Key ID [None]: YOUR_ACCESS_KEY_ID
  AWS Secret Access Key [None]: YOUR_SECRET_ACCESS_KEY
  Default region name [None]: your-preferred-region (e.g., us-west-2)
  Default output format [None]: json
  ```

4. 確認:
  設定が正しく行われたか確認するには、以下のコマンドを実行します：
  ```bash
  $ aws sts get-caller-identity
  ```
  このコマンドが正常に実行され、あなたのAWSアカウント情報が表示されれば、認証情報が正しく設定されています。

5. 設定ファイルの場所:
  - credentials ファイル: `~/.aws/credentials` (Linux/Mac) or `%UserProfile%\.aws\credentials` (Windows)
  - config ファイル: `~/.aws/config` (Linux/Mac) or `%UserProfile%\.aws\config` (Windows)

6. 複数のプロファイルの設定:
  異なるAWSアカウントやロールを使用する場合は、`--profile` オプションを使用して複数のプロファイルを設定できます：
  ```bash
  $ aws configure --profile profilename
  ```

注意点:
- シークレットアクセスキーは非常に重要な情報です。安全に管理し、絶対に他人と共有しないでください。
- アクセスキーを定期的にローテーションすることをお勧めします。
- 可能な限り、IAMロールを使用してアクセスを管理することを検討してください。

## Set Environment

Edit serverless.yml

```yml
CHANNEL_ACCESS_TOKEN: "YOUR LINE CHANNEL ACCESS TOKEN"
CHANNEL_SECRET: "YOUR LINE CHANNEL ACCESS TOKEN"
```

## Deploy

In order to deploy the endpoint simply run

```bash
$ sam package --output-template-file template.yaml --s3-bucket amazon-bedrock-bot-dev-bucket
$ sam deploy --template-file template.yml
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

## CI/CD 環境での対応

1. 環境変数の設定:
  - `AWS_ACCESS_KEY_ID` と `AWS_SECRET_ACCESS_KEY` を CI/CD システムの環境変数として設定します。

2. `serverless.yml` の修正:
  - `org` と `app` の行を削除または commentout します。

3. デプロイスクリプト:
  ```bash
  #!/bin/bash
  serverless deploy --verbose
  ```

## トラブルシューティング

1. 認証エラーが発生する場合:
  - AWS 認証情報が正しく設定されているか確認します。
  - `aws sts get-caller-identity` を実行して AWS 認証情報をテストします。

2. リージョンの問題:
  - `serverless.yml` で正しい AWS リージョンが設定されているか確認します。
  - または、環境変数 `AWS_DEFAULT_REGION` を設定します。

3. 権限の問題:
  - 使用している IAM ユーザーまたはロールに必要な権限があることを確認します。

## Usage

## Scaling

### AWS Lambda

By default, AWS Lambda limits the total concurrent executions across all functions within a given region to 100. The default limit is a safety limit that protects you from costs due to potential runaway or recursive functions during initial development and testing. To increase this limit above the default, follow the steps in [To request a limit increase for concurrent executions](http://docs.aws.amazon.com/lambda/latest/dg/concurrent-executions.html#increase-concurrent-executions-limit).
