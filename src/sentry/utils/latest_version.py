from django.core.cache import cache

_CACHE_KEY = "sentry:latest_version"
# The beacon task refreshes this hourly; keep it through a missed run.
_TIMEOUT_SECONDS = 25 * 60 * 60


def get_latest_version() -> str | None:
    return cache.get(_CACHE_KEY)


def set_latest_version(version: str) -> None:
    cache.set(_CACHE_KEY, version, _TIMEOUT_SECONDS)
