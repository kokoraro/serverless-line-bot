## Node.js Lambda レイヤーの作成手順

1. レイヤー用のディレクトリ構造を作成する:
   ```
   my-layer/
   └── nodejs/
       └── node_modules/
           └── (ここに依存パッケージが入ります)
   ```

2. `my-layer/nodejs` ディレクトリに移動し、`package.json` を作成:
   ```bash
   cd my-layer/nodejs
   npm init -y
   ```

3. 必要な依存パッケージをインストール:
   ```bash
   npm install --save your-package-name
   ```

4. プロダクション用の依存パッケージのみをインストール:
   ```bash
   npm install --production
   ```

5. レイヤーをZIPファイルにパッケージ化:
   ```bash
   cd ..
   zip -r my-layer.zip nodejs
   ```

6. AWS CLIを使用してレイヤーをAWSにアップロード:
   ```bash
   aws lambda publish-layer-version \
     --layer-name my-nodejs-layer \
     --description "My Node.js dependencies layer" \
     --zip-file fileb://my-layer.zip \
     --compatible-runtimes nodejs14.x nodejs16.x
   ```

7. Serverless Frameworkを使用している場合、`serverless.yml` にレイヤーを定義:
   ```yaml
   layers:
     myNodejsLayer:
       path: my-layer
       name: ${self:service}-${self:provider.stage}-my-nodejs-layer
       description: My Node.js dependencies layer
       compatibleRuntimes:
         - nodejs14.x
         - nodejs16.x
   ```

8. 関数でレイヤーを使用:
   ```yaml
   functions:
     myFunction:
       handler: handler.hello
       layers:
         - {Ref: MyNodejsLayerLambdaLayer}
   ```

注意点:
- レイヤーのサイズ制限は250MB（解凍後）です。
- レイヤーは読み取り専用であり、実行時に変更できません。
- 複数のレイヤーを使用する場合、順序が重要です（後のレイヤーが前のレイヤーを上書きします）。