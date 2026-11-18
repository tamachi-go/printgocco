# PrintGocco

connpassの参加者一覧ページから参加者名を取得し、A4縦の名刺サイズ（91mm × 55mm、2列 × 5段の10面）に並べて印刷するためのChrome拡張機能です。

## 動作確認方法

### ローカルのサンプルデータで確認する（手軽な確認）

以下のコマンドを実行すると、テストデータ（デフォルト15名分）が入ったconnpassモックページおよび参加者JSONを `sample/` 配下に生成し、`http://localhost:8000` でローカルサーバーを起動します。

```bash
make serve
```

人数やポート番号を変えたい場合は引数で指定できます（生成のみ行う場合は `make sample`）。

```bash
make serve COUNT=25 PORT=8080
# または直接スクリプトを実行
python3 scripts/sample.py --count 25 --serve --port 8080
```

サーバー起動後、以下の2通りの方法で確認できます。

- **印刷レイアウトを直接確認する（拡張機能の読み込み不要）**
  - http://localhost:8000/print.html を開くと、`sample/participants.json` のテストデータを読み込んでA4縦10面の名刺レイアウトが表示されます。
- **connpassモックページでChrome拡張機能を通して確認する**
  - http://localhost:8000/sample/event/406969/participation/#participants を開き、後述の手順で読み込んだChrome拡張機能のアイコンをクリックして動作を確認できます（キャンセル枠のユーザーが除外されることも確認できます）。

---

### Chromeに拡張機能を読み込んで確認する

#### 1. Chromeに拡張機能を読み込む

1. Google Chromeで `chrome://extensions/` を開きます。
2. 画面右上の「デベロッパー モード」をONにします。
3. 左上の「パッケージ化されていない拡張機能を読み込む」をクリックします。
4. このリポジトリのディレクトリ（`manifest.json` があるフォルダ）を選択します。

#### 2. connpassの参加者一覧ページで実行する

1. connpassのイベント参加者一覧ページ（または上記のローカルモックページ）を開きます。
   - 本番ページ例: https://tamachi-go.connpass.com/event/406969/participation/#participants
   - ローカルモック: http://localhost:8000/sample/event/406969/participation/#participants
2. Chromeのツールバーから「PrintGocco - connpass 名刺印刷」のアイコンをクリックします（一覧に出ていない場合はパズルピース型の拡張機能アイコンから選択します）。
3. ポップアップに取得した参加者数が表示されたら、「名刺印刷ページを開く」をクリックします。

#### 3. 印刷プレビューを確認する

1. 新しいタブで名刺一覧ページ（`print.html`）が開き、A4縦1ページあたり最大10枚（2列 × 5段、各91mm × 55mm）のマス目と参加者名が表示されます。
2. 画面上部の「印刷する (A4縦)」ボタンをクリックします。
3. Chromeの印刷ダイアログで以下を確認して印刷（またはPDF保存）します。
   - **用紙サイズ**: A4
   - **レイアウト**: 縦
   - **余白**: なし（またはデフォルトのまま100%スケール）
   - **倍率**: 100%（実寸）
