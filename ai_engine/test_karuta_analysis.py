import unittest

from karuta_analysis import analyze


class KarutaAnalysisTests(unittest.TestCase):
    def test_empty_payload_is_safe(self):
        result = analyze({})
        self.assertFalse(result["externalApiUsed"])
        self.assertEqual(result["practiceSummary"]["total"], 0)
        self.assertTrue(result["insights"])
        self.assertTrue(result["suggestions"])

    def test_summary_uses_supplied_app_summary(self):
        result = analyze({
            "targetPlayer": {"name": "テスト選手", "rank": "B級"},
            "practiceSummary": {"total": 10, "wins": 6, "losses": 4, "winRate": 0.6, "avgMargin": 2.2},
            "recentResults": [],
        })
        self.assertEqual(result["targetPlayer"]["name"], "テスト選手")
        self.assertEqual(result["practiceSummary"]["total"], 10)
        self.assertTrue(any("60%" in item for item in result["insights"]))

    def test_opponent_results_are_grouped(self):
        result = analyze({
            "recentResults": [
                {"date": "2026-01-01", "win": True, "opponent": "相手A", "opponentRank": "B級", "margin": 2},
                {"date": "2026-01-02", "win": False, "opponent": "相手A", "opponentRank": "B級", "margin": 3},
                {"date": "2026-01-03", "win": True, "opponent": "相手A", "opponentRank": "B級", "margin": 1},
            ]
        })
        self.assertEqual(len(result["opponents"]), 1)
        self.assertEqual(result["opponents"][0]["total"], 3)
        self.assertEqual(result["opponents"][0]["wins"], 2)
        self.assertEqual(result["opponents"][0]["winRate"], 0.6667)

    def test_trend_compares_recent_and_previous_ten(self):
        rows = []
        for i in range(20):
            rows.append({
                "date": f"2026-01-{i + 1:02d}",
                "win": i >= 10,
                "opponent": f"相手{i % 3}",
                "opponentRank": "B級",
                "margin": 2,
            })
        result = analyze({"recentResults": rows})
        self.assertEqual(result["trend"]["previous"]["winRate"], 0.0)
        self.assertEqual(result["trend"]["recent"]["winRate"], 1.0)
        self.assertEqual(result["trend"]["winRateChange"], 1.0)

    def test_payload_with_missing_fields_does_not_crash(self):
        result = analyze({
            "targetPlayer": None,
            "recentResults": [{"win": "win", "margin": "3"}],
            "tournamentResults": None,
        })
        self.assertEqual(result["practiceSummary"]["wins"], 1)
        self.assertFalse(result["externalApiUsed"])


if __name__ == "__main__":
    unittest.main()
