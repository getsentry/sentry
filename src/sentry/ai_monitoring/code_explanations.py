import hashlib

import orjson

from sentry.cache import default_cache as cache
from sentry.models.project import Project
from sentry.seer.oneshot import run_oneshot
from sentry.utils import metrics

MAX_CODE_LENGTH = 4_000
MAX_SUMMARY_LENGTH = 256
MAX_SUMMARY_WORDS = 12
CACHE_TTL = 24 * 60 * 60
SEER_TIMEOUT = 10


def get_code_explanation(project: Project, code: str, language: str) -> str | None:
    organization = project.organization
    payload = {"code": code, "language": language}
    digest = hashlib.sha256(orjson.dumps(payload)).hexdigest()
    cache_key = f"ai:code-explanation:v1:{organization.id}:{project.id}:{digest}"
    cached = cache.get(cache_key)
    if isinstance(cached, str) and cached:
        metrics.incr("ai_monitoring.code_explanation", tags={"result": "cache_hit"})
        return cached

    try:
        result = run_oneshot(
            "code_explanation",
            payload,
            organization,
            timeout=SEER_TIMEOUT,
        )
        summary = result.get("summary")
    except Exception:
        metrics.incr("ai_monitoring.code_explanation", tags={"result": "request_error"})
        return None

    if not isinstance(summary, str):
        metrics.incr("ai_monitoring.code_explanation", tags={"result": "invalid_response"})
        return None
    summary = " ".join(summary.split())
    if not summary or len(summary) > MAX_SUMMARY_LENGTH or len(summary.split()) > MAX_SUMMARY_WORDS:
        metrics.incr("ai_monitoring.code_explanation", tags={"result": "invalid_response"})
        return None

    cache.set(cache_key, summary, timeout=CACHE_TTL)
    metrics.incr("ai_monitoring.code_explanation", tags={"result": "success"})
    return summary
