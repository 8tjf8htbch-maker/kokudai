"""Local, deterministic analysis for the Kokudai Karuta app.

This module intentionally uses only the Python standard library and performs
all calculations locally. It does not make network requests or call an LLM.
Input is the JSON-compatible payload currently built by extensions.js.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date
from math import isfinite
from typing import Any


def _number(value: Any, default: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return number if isfinite(number) else default


def _is_win(value: Any) -> bool:
    return value is True or value == 1 or value == "win"


def _summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    total = len(rows)
    wins = sum(1 for row in rows if _is_win(row.get("win")))
    margins = [_number(row.get("margin")) for row in rows if row.get("margin") is not None]
    return {
        "total": total,
        "wins": wins,
        "losses": total - wins,
        "winRate": round(wins / total, 4) if total else None,
        "averageMargin": round(sum(margins) / len(margins), 2) if margins else None,
    }


def _valid_date(value: Any) -> str:
    text = str(value or "")
    try:
        return date.fromisoformat(text[:10]).isoformat()
    except ValueError:
        return ""


def _trend(rows: list[dict[str, Any]]) -> dict[str, Any]:
    ordered = sorted(
        (row for row in rows if _valid_date(row.get("date"))),
        key=lambda row: _valid_date(row.get("date")),
    )
    recent = ordered[-10:]
    previous = ordered[-20:-10]
    recent_summary = _summary(recent)
    previous_summary = _summary(previous)
    change = None
    if recent_summary["winRate"] is not None and previous_summary["winRate"] is not None:
        change = round(recent_summary["winRate"] - previous_summary["winRate"], 4)
    return {
        "recent": recent_summary,
        "previous": previous_summary,
        "winRateChange": change,
        "sampleSizeNote": "各期間の試合数が少ない場合、勝率の変化は参考値です。",
    }


def _opponent_analysis(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    ranks: dict[str, str] = {}
    for row in rows:
        name = str(row.get("opponent") or "").strip()
        if not name:
            continue
        grouped[name].append(row)
        ranks[name] = str(row.get("opponentRank") or "不明")

    result = []
    for name, matches in grouped.items():
        stats = _summary(matches)
        result.append({
            "name": name,
            "rank": ranks[name],
            **stats,
            "reliability": "参考値" if len(matches) < 3 else "一定の参考情報",
        })
    return sorted(result, key=lambda item: (-item["total"], item["name"]))


def analyze(payload: dict[str, Any]) -> dict[str, Any]:
    """Return explainable stats and practice suggestions from an app payload."""
    payload = payload if isinstance(payload, dict) else {}
    target = payload.get("targetPlayer") or {}
    recent_rows = payload.get("recentResults") or []
    tournament_rows = payload.get("tournamentResults") or []
    practice_rows = [row for row in recent_rows if isinstance(row, dict)]
    tournament_rows = [row for row in tournament_rows if isinstance(row, dict)]

    practice_summary = payload.get("practiceSummary")
    if not isinstance(practice_summary, dict):
        practice_summary = _summary(practice_rows)
    else:
        # Keep the app's existing avgMargin field while providing a stable,
        # numeric value for the analysis output.
        practice_summary = dict(practice_summary)
        practice_summary["avgMargin"] = _number(
            practice_summary.get("avgMargin", practice_summary.get("averageMargin"))
        )
    tournament_summary = payload.get("tournamentSummary")
    if not isinstance(tournament_summary, dict):
        tournament_summary = _summary(tournament_rows)
    else:
        tournament_summary = dict(tournament_summary)
        tournament_summary["avgMargin"] = _number(
            tournament_summary.get("avgMargin", tournament_summary.get("averageMargin"))
        )

    insights: list[str] = []
    suggestions: list[str] = []
    total = int(_number(practice_summary.get("total")))

    if total < 5:
        insights.append("練習試合の記録がまだ少ないため、現時点の傾向は参考値です。")
        suggestions.append("まずは練習試合の結果を継続して記録し、判断材料を増やしましょう。")
    else:
        rate = practice_summary.get("winRate")
        if rate is not None:
            insights.append(
                f"記録上の練習勝率は{round(_number(rate) * 100)}%です（{total}試合）。"
            )

    trend = _trend(practice_rows)
    change = trend["winRateChange"]
    if change is not None and trend["recent"]["total"] >= 5 and trend["previous"]["total"] >= 5:
        if change >= 0.15:
            insights.append("直近10試合の勝率は、その前の期間より上がっています。")
        elif change <= -0.15:
            insights.append("直近10試合の勝率は、その前の期間より下がっています。練習テーマや相手の変化も合わせて確認しましょう。")
        else:
            insights.append("直近とその前の期間で、勝率に大きな差は見られません。")

    # The app supplies opponentSummary over the full practice history, while
    # recentResults is intentionally capped at 20 rows. Prefer the full summary
    # so opponent comparisons are not accidentally limited to recent matches.
    supplied_opponents = payload.get("opponentSummary")
    if isinstance(supplied_opponents, list):
        opponents = []
        for item in supplied_opponents:
            if not isinstance(item, dict) or not str(item.get("name") or "").strip():
                continue
            total_matches = int(_number(item.get("total")))
            wins = int(_number(item.get("wins")))
            win_rate = item.get("winRate")
            if win_rate is None and total_matches:
                win_rate = wins / total_matches
            opponents.append({
                "name": str(item["name"]),
                "rank": str(item.get("rank") or "不明"),
                "total": total_matches,
                "wins": wins,
                "losses": int(_number(item.get("losses"), max(0, total_matches - wins))),
                "winRate": round(_number(win_rate), 4) if win_rate is not None else None,
                "avgMargin": _number(item.get("avgMargin")),
                "reliability": "参考値" if total_matches < 3 else "一定の参考情報",
            })
        opponents.sort(key=lambda item: (-item["total"], item["name"]))
    else:
        opponents = _opponent_analysis(practice_rows)
    sufficiently_sampled = [item for item in opponents if item["total"] >= 3]
    if sufficiently_sampled:
        lowest = min(sufficiently_sampled, key=lambda item: item["winRate"] if item["winRate"] is not None else 1)
        highest = max(sufficiently_sampled, key=lambda item: item["winRate"] if item["winRate"] is not None else -1)
        insights.append(f"{lowest['name']}さんとの対戦は{lowest['total']}試合中{lowest['wins']}勝です。相性の判断は対戦数も踏まえてください。")
        if highest["name"] != lowest["name"]:
            insights.append(f"{highest['name']}さんとの対戦は{highest['total']}試合中{highest['wins']}勝です。")

    if len(opponents) >= 2:
        most_frequent = max(opponents, key=lambda item: item["total"])
        if most_frequent["total"] >= 3:
            suggestions.append(f"対戦が多い{most_frequent['name']}さん以外の相手とも組み、経験する相手を広げてみましょう。")

    margins = [_number(row.get("margin")) for row in practice_rows if row.get("margin") is not None]
    if len(margins) >= 5:
        avg_margin = sum(margins) / len(margins)
        insights.append(f"記録上の平均枚差は{avg_margin:.1f}枚です。勝敗だけでなく、枚差の推移も確認しましょう。")

    if not suggestions:
        suggestions.append("次回は練習テーマを一つ決め、試合後に気づきをメモして記録と照らし合わせましょう。")

    return {
        "engine": "kokudai-local-stats-v1",
        "externalApiUsed": False,
        "targetPlayer": {
            "name": str(target.get("name") or "対象選手"),
            "rank": str(target.get("rank") or "不明"),
        },
        "practiceSummary": practice_summary,
        "tournamentSummary": tournament_summary,
        "trend": trend,
        "opponents": opponents,
        "insights": insights,
        "suggestions": suggestions,
        "limitations": [
            "これは記録に基づく統計分析で、試合の原因や選手の実力を断定するものではありません。",
            "対戦数が少ない相手の勝率は大きく変動するため、参考値として扱ってください。",
            "現段階では機械学習による勝敗予測は行っていません。",
        ],
    }
