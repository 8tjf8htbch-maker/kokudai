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
