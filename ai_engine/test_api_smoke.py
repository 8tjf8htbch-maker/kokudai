"""Launch the real ASGI server and verify its HTTP contract using synthetic data."""
from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


def main() -> None:
    token = "synthetic-smoke-test-token"
    env = os.environ.copy()
    env["KOKUDAI_AI_API_TOKEN"] = token
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]

    base = f"http://127.0.0.1:{port}"
    process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "api:app", "--host", "127.0.0.1", "--port", str(port)],
        cwd=Path(__file__).resolve().parent,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        for _ in range(80):
            if process.poll() is not None:
                raise RuntimeError("API server exited before becoming ready")
            try:
                with urllib.request.urlopen(base + "/health", timeout=1) as response:
                    health = json.loads(response.read().decode("utf-8"))
                    assert health["status"] == "ok"
                    break
            except (urllib.error.URLError, TimeoutError, ConnectionError):
                time.sleep(0.1)
        else:
            raise RuntimeError("API server did not become ready")

        payload = {
            "targetPlayer": {"name": "Synthetic Player", "rank": "B級"},
            "practiceSummary": {"total": 6, "wins": 4, "losses": 2, "winRate": 0.6667},
            "recentResults": [],
            "tournamentResults": [],
        }
        body = json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            base + "/api/analysis/v1/analyze",
            data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}",
            },
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=3) as response:
            result = json.loads(response.read().decode("utf-8"))
            assert response.status == 200
            assert response.headers.get("Cache-Control") == "no-store"
        assert result["engine"] == "kokudai-local-stats-v1"
        assert result["externalApiUsed"] is False
        assert result["targetPlayer"]["name"] == "Synthetic Player"
        assert isinstance(result["insights"], list)
        print("API smoke test passed (synthetic data only).")

        bad_request = urllib.request.Request(
            base + "/api/analysis/v1/analyze",
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            urllib.request.urlopen(bad_request, timeout=3)
        except urllib.error.HTTPError as exc:
            assert exc.code == 401
        else:
            raise AssertionError("Unauthenticated request was unexpectedly accepted")
        print("Authentication rejection passed.")
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


if __name__ == "__main__":
    main()
