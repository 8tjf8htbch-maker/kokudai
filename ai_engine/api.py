"""Authenticated HTTP adapter for the local karuta stats engine.

Run locally only by default. No data is persisted and request bodies are never logged.
"""
from __future__ import annotations

import hmac
import json
import os
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse

from karuta_analysis import analyze

MAX_BODY_BYTES = 1_000_000
TOKEN_ENV = "KOKUDAI_AI_API_TOKEN"

app = FastAPI(
    title="Kokudai Local Analysis API",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


@app.middleware("http")
async def no_store_and_size_limit(request: Request, call_next):
    if request.url.path == "/api/analysis/v1/analyze":
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > MAX_BODY_BYTES:
                    return JSONResponse(status_code=413, content={"detail": "Request body too large"})
            except ValueError:
                return JSONResponse(status_code=400, content={"detail": "Invalid Content-Length"})
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "engine": "kokudai-local-stats-v1"}


@app.post("/api/analysis/v1/analyze")
async def run_analysis(
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    expected_token = os.environ.get(TOKEN_ENV, "")
    if not expected_token:
        raise HTTPException(status_code=503, detail="API authentication is not configured")

    scheme, _, supplied_token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not supplied_token or not hmac.compare_digest(
        supplied_token, expected_token
    ):
        raise HTTPException(status_code=401, detail="Unauthorized")

    # Enforce the limit while streaming, even when Content-Length is absent.
    chunks: list[bytes] = []
    body_size = 0
    async for chunk in request.stream():
        body_size += len(chunk)
        if body_size > MAX_BODY_BYTES:
            raise HTTPException(status_code=413, detail="Request body too large")
        chunks.append(chunk)
    body = b"".join(chunks)
    try:
        payload = json.loads(body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="Invalid JSON") from None
    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="JSON body must be an object")

    # Reject malformed top-level shapes rather than letting them become server errors.
    for key in ("targetPlayer", "practiceSummary", "tournamentSummary"):
        if key in payload and payload[key] is not None and not isinstance(payload[key], dict):
            raise HTTPException(status_code=422, detail=f"{key} must be an object")
    for key in ("recentResults", "opponentSummary", "tournamentResults"):
        if key in payload and payload[key] is not None and not isinstance(payload[key], list):
            raise HTTPException(status_code=422, detail=f"{key} must be an array")

    # Analyze in memory only. Do not print payloads, names, or results to logs.
    return analyze(payload)
