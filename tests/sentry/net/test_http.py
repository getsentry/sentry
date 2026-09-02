from requests.adapters import DEFAULT_POOLSIZE

from sentry.net.http import SafeSession


def _pool(session: SafeSession):
    return session.get_adapter("https://example.com").poolmanager.connection_from_url(
        "https://example.com"
    )


def test_safe_session_default_pool_size() -> None:
    pool = _pool(SafeSession())
    assert pool.pool is not None
    assert pool.pool.maxsize == DEFAULT_POOLSIZE


def test_safe_session_pool_maxsize_reaches_the_connection_pool() -> None:
    pool = _pool(SafeSession(pool_maxsize=40))
    assert pool.pool is not None
    assert pool.pool.maxsize == 40
