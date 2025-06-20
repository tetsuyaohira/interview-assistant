# 面接アシスタント

Web面接の音声を文字起こしして、OpenAI APIで面接回答を生成するElectronアプリケーション

## 機能

- **音声キャプチャ**: マイク音声をリアルタイムで録音
- **文字起こし**: OpenAI Whisper APIを使用した高精度な音声→テキスト変換
- **テキスト選択**: 文字起こし結果から必要な部分を選択
- **面接回答生成**: 選択したテキストに対してOpenAI APIで適切な面接回答を生成
- **2ペインUI**: 左側に文字起こし、右側に回答を表示

## 前提条件

### システム要件
- macOS (現在macOSのみ対応)
- Node.js 18+ 
- npm または yarn

### 必要なライブラリ

#### Homebrew経由でインストール
```bash
# 音声録音に必要
brew install sox

# システム音声キャプチャ用仮想オーディオデバイス
brew install blackhole-2ch
```

#### npm dependencies
```bash
# 開発依存関係
npm install --save-dev electron typescript ts-node electron-rebuild @types/node @types/fs-extra

# 本体依存関係  
npm install openai dotenv mic node-record-lpcm16
```

## セットアップ

### 1. リポジトリのクローン
```bash
git clone <repository-url>
cd interview-assistant
```

### 2. 依存関係のインストール
```bash
# System dependencies
brew install sox
brew install blackhole-2ch

# Node.js dependencies
npm install
```

### 3. 環境設定
```bash
# .envファイルを作成
cp .env.example .env
```

`.env`ファイルを編集してOpenAI APIキーを設定:
```env
# OpenAI API Key for Whisper transcription
OPENAI_API_KEY=your_openai_api_key_here
```

### 4. BlackHoleの設定
```bash
# BlackHoleがインストールされているか確認
ls /Applications/BlackHole*

# Audio MIDI設定でマルチ出力デバイスを作成（後述）
```

**重要**: BlackHoleの設定手順（下記「BlackHole設定」セクション参照）

### 5. ビルドと実行
```bash
# TypeScriptをビルド
npm run build

# アプリケーションを起動
npm start

# 開発モード（DevToolsあり）
npm run dev
```

## BlackHole設定

### システム音声キャプチャの設定手順

1. **Audio MIDI設定を開く**
   ```bash
   open "/Applications/Utilities/Audio MIDI Setup.app"
   ```

2. **マルチ出力デバイスを作成**
   - 左下の「+」ボタン → 「マルチ出力デバイスを作成」
   - デバイス名: 「Multi-Output Device」
   - チェックボックス:
     - ✅ 内蔵スピーカー（または使用中のスピーカー）
     - ✅ BlackHole 2ch

3. **システム音声出力を変更**
   - システム環境設定 → サウンド → 出力
   - 「Multi-Output Device」を選択

4. **面接ツール使用時**
   - Zoom/Teams等のマイク設定で「BlackHole 2ch」を選択
   - またはシステム音声入力を「BlackHole 2ch」に設定

### 注意事項
- **音声が聞こえなくなった場合**: システム音声出力を「内蔵スピーカー」に戻す
- **面接後**: システム音声設定を元に戻すことを忘れずに

## 使い方

### 1. APIキー設定確認
- アプリ起動後、「.envファイルにAPIキーが設定されています」と表示されることを確認
- 「準備完了」ステータスが表示されることを確認

### 2. システム音声録音と文字起こし
1. BlackHoleの設定が完了していることを確認
2. Zoom/Teams等でマイクを「BlackHole 2ch」に設定
3. 「録音開始」ボタンをクリック
4. 面接が開始されると、システム音声が自動的に文字起こしされる
5. 左ペインに文字起こし結果が表示される
6. 自分が話すときは「一時停止」ボタンでテキスト化を停止

### 3. テキスト選択と回答生成
1. 左ペインの文字起こしテキストから必要な部分を選択
2. 表示される「面接回答を生成」ボタンをクリック
3. OpenAI APIで面接回答が生成され、右ペインに表示される

### 4. プロファイル設定
- `profile.md`ファイルを編集して個人情報を設定
- 経験、スキル、プロジェクト情報などを記載
- 面接回答の生成時に参照される

## 開発

### プロジェクト構造
```
src/
├── main.ts              # メインプロセス
├── preload.ts           # プリロードスクリプト
├── renderer.ts          # レンダラープロセス
├── audioCapture.ts      # 音声キャプチャクラス
├── transcriptionService.ts # 文字起こしサービス
├── interviewAssistantService.ts # 面接アシスタントサービス
├── index.html           # UI
├── styles.css           # スタイリング
└── types/
    └── mic.d.ts         # mic パッケージの型定義
```

### スクリプト
```bash
npm run build        # TypeScriptをコンパイル
npm run build:watch  # TypeScriptを監視モードでコンパイル
npm run clean        # ビルドファイルを削除
npm run rebuild      # クリーンビルド
npm start           # アプリケーションを起動
npm run dev         # 開発モード（DevTools付き）
npm run package     # アプリケーションをパッケージ化
```

## トラブルシューティング

### 音声録音エラー
**エラー**: `spawn rec ENOENT`
**解決方法**: 
```bash
brew install sox
```

### APIキーエラー
**エラー**: 「APIキー未設定」と表示される
**解決方法**: 
1. `.env`ファイルが存在することを確認
2. `OPENAI_API_KEY`が正しく設定されていることを確認
3. アプリを再起動

### マイクアクセスエラー
**解決方法**: 
1. システム環境設定 > セキュリティとプライバシー > プライバシー > マイク
2. Electronアプリにマイクアクセスを許可

### BlackHole音声が取得できない
**エラー**: 音声キャプチャが開始されない
**解決方法**:
1. BlackHoleが正しくインストールされているか確認
2. マルチ出力デバイスの設定を確認
3. システム音声出力が「Multi-Output Device」になっているか確認
4. 面接ツール（Zoom/Teams）のマイク設定が「BlackHole 2ch」になっているか確認

### 音声が聞こえない
**解決方法**:
1. システム環境設定 > サウンド > 出力を「内蔵スピーカー」に変更
2. Audio MIDI設定でマルチ出力デバイスに内蔵スピーカーが含まれているか確認

## 技術スタック

- **Framework**: Electron + TypeScript
- **音声処理**: SoX + mic package + BlackHole (システム音声キャプチャ)
- **文字起こし**: OpenAI Whisper API
- **AI連携**: OpenAI GPT-3.5-turbo API
- **UI**: HTML + CSS (Vanilla JS)

## ライセンス

MIT

## 開発状況

### 完了済み機能
- ✅ Electronアプリ基本構造
- ✅ 2ペインUI実装
- ✅ マイク音声キャプチャ
- ✅ OpenAI Whisper API文字起こし
- ✅ .envファイルでのAPIキー管理
- ✅ TypeScript対応

### 完了済み機能（追加）
- ✅ テキスト選択→ボタン表示
- ✅ OpenAI API面接回答生成
- ✅ プロファイル設定（profile.md）

### 実装予定機能
- 📋 話者識別機能
- 📋 回答履歴保存
- 📋 音声デバイス自動検出
- 📋 回答テンプレート機能