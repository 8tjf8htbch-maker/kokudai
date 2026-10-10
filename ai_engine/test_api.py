"""Contract tests for the API adapter; synthetic data only."""
from __future__ import annotations

import os
import unittest
from unittest.mock import patch

try:
    from fastapi.testclient import TestClient
    from api import app
except ImportError:  # Keep the standard-library engine tests usable without API extras.
    TestClient = None
    app = None


@unittest.skipIf(TestClient is None, "Install ai_engine/requirements.txt to run API tests")
class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.env = patch.dict(os.environ, {"KOKUDAI_AI_API_TOKEN": "test-only-token"})
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_health_has_no_store_header(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("cache-control"), "no-store")

    def test_missing_token_is_rejected(self):
        response = self.client.post(
            "/api/analysis/v1/analyze",
            json={"targetPlayer": {"name": "Synthetic Player"}},
        )
        self.assertEqual(response.status_code, 401)

    def test_valid_token_returns_local_analysis(self):
        response = self.client.post(
            "/api/analysis/v1/analyze",
            headers={"Authorization": "Bearer test-only-token"},
            json={
                "targetPlayer": {"name": "Synthetic Player", "rank": "B級"},
                "recentResults": [],
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["engine"], "kokudai-local-stats-v1")
        self.assertFalse(response.json()["externalApiUsed"])
        self.assertEqual(response.headers.get("cache-control"), "no-store")

    def test_missing_server_secret_fails_closed(self):
        with patch.dict(os.environ, {}, clear=True):
            response = self.client.post(
                "/api/analysis/v1/analyze",
                headers={"Authorization": "Bearer test-only-token"},
                json={},
            )
        self.assertEqual(response.status_code, 503)

    def test_oversized_request_rejected(self):
        response = self.client.post(
            "/api/analysis/v1/analyze",
            headers={
                "Authorization": "Bearer test-only-token",
                "Content-Length": "1000001",
            },
            content=b"{}",
        )
        self.assertEqual(response.status_code, 413)


if __name__ == "__main__":
    unittest.main()
