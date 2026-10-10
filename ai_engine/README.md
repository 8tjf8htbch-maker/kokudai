# 國大練習：ローカル戦績分析エンジン

Python標準ライブラリだけで動く、初期版の統計分析エンジンです。現在のWebアプリとは独立した `ai_engine/` ディレクトリに置いています。

## 方針

- 外部ネットワークへの通信を行いません。
- Geminiなどの生成AI APIを呼び出しません。
- 入力データをファイルへ自動保存したり、ログへ出力したりしません。
- まずは説明可能な統計分析を実装し、記録量と評価方法を確認してから機械学習を検討します。
- このコードを追加しただけでは、既存WebアプリのREAL AIは置き換わりません。アプリとの接続は別工程です。

## 実行方法

Python 3.10以降を想定しています。追加ライブラリのインストールは不要です。

```bash
cd ai_engine
python -m unittest -v
```

## Pythonから利用

```python
from karuta_analysis import analyze

payload = {
    "targetPlayer": {"name": "選手名", "rank": "B級"},
    "practiceSummary": {
        "total": 8, "wins": 5, "losses": 3,
        "winRate": 0.625, "avgMargin": 2.0
    },
    "recentResults": [
        {
            "date": "2026-09-01",
            "win": True,
            "opponent": "相手A",
            "opponentRank": "B級",
            "margin": 2
        }
    ],
    "tournamentSummary": {"total": 0, "wins": 0, "losses": 0, "winRate": None},
    "tournamentResults": []
}

result = analyze(payload)
print(result["insights"])
print(result["suggestions"])
```

入力形式は、既存アプリの `extensions.js` にある `xBuildAiPayload` の形式に合わせています。選手名などの情報を含む実データは、公開リポジトリのテストデータやコミットに入れないでください。

## 初期版の出力

- 練習・大会の集計
- 直近10試合とその前の最大10試合の比較
- 相手別の勝率と試合数
- 記録に基づく短い所見・練習提案
- データ量や解釈に関する注意書き

この段階では、勝敗予測モデルや動画解析はまだ含みません。統計値は練習記録の傾向を示すもので、勝敗の原因や選手の実力を断定するものではありません。


## ローカルAPIプロトタイプ（本番未接続）

Python分析エンジンをHTTP経由で呼び出すための試作APIです。GitHub PagesやSupabase、本番の選手データとは接続していません。

### 起動

Python 3.10以降で、まず依存ライブラリをインストールします。

```bash
cd ai_engine
python -m venv .venv
# macOS/Linux:
source .venv/bin/activate
# Windows PowerShell:
# .venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
```

APIトークンは自分のPC上で生成し、環境変数として設定してください。トークンをソースコード、GitHub、フロントエンドに書き込まないでください。

```bash
# macOS/Linux: ターミナルごとに設定
export KOKUDAI_AI_API_TOKEN="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
uvicorn api:app --host 127.0.0.1 --port 8000
```

Windows PowerShellの場合は、`$env:KOKUDAI_AI_API_TOKEN = [guid]::NewGuid().ToString() + [guid]::NewGuid().ToString()` を設定してから起動します。

- ヘルスチェック：`GET http://127.0.0.1:8000/health`
- 分析：`POST http://127.0.0.1:8000/api/analysis/v1/analyze`（`Authorization: Bearer <トークン>` が必須）
- APIドキュメント画面は無効にしています。
- 入力本文は最大約1MB。レスポンスはキャッシュ禁止です。
- APIは分析結果を保存せず、生成AI APIにも送信しません。

### セキュリティ上の重要な制約

この試作はローカルPCの `127.0.0.1` にだけバインドしてください。インターネットに公開するための完成版ではありません。CORS許可設定、レート制限、HTTPS、認証済みユーザーと選手データの権限検証、ホスティング事業者のログ・保存方針などを別途レビューする必要があります。

静的なGitHub PagesのJavaScriptに共通APIトークンを埋め込むと、利用者に見えてしまうため禁止です。本番接続には、共有トークンを配るのではなく、利用者認証とサーバー側のアクセス権検証を設計してください。テストには合成データだけを使ってください。

### APIテスト

```bash
pip install -r requirements.txt
python -m unittest -v
```
