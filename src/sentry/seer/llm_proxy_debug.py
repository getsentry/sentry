from collections.abc import Generator
from contextlib import contextmanager
from contextvars import ContextVar

FRONTEND_FORCE_402_HEADER = "X-Sentry-Force-LLM-Proxy-402"
SEER_FORCE_402_HEADER = "X-Seer-Force-402"
TASK_FORCE_402_HEADER = "sentry-force-llm-proxy-402"

_force_llm_proxy_402: ContextVar[bool] = ContextVar("force_llm_proxy_402", default=False)


def should_force_llm_proxy_402() -> bool:
    if _force_llm_proxy_402.get():
        return True

    # Import lazily because taskworker loads this module while sentry.app is
    # still initializing.
    from sentry.app import env

    request = env.request
    return bool(
        request is not None and request.headers.get(FRONTEND_FORCE_402_HEADER, "").lower() == "true"
    )


@contextmanager
def force_llm_proxy_402_scope(enabled: bool) -> Generator[None]:
    token = _force_llm_proxy_402.set(enabled)
    try:
        yield
    finally:
        _force_llm_proxy_402.reset(token)
