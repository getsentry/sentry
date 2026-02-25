import pytest

from sentry.options import default_store


@pytest.fixture(autouse=True)
def _reset_default_store_cache():
    """Reset default_store.cache after tests to prevent pollution.

    bind_cache_to_option_store() globally mutates default_store.cache via
    set_cache_impl(). override_settings restores CACHES but not the option
    store's cache reference, leaving it pointing to a stale ConnectionProxy.
    """
    original_cache = default_store.cache
    yield
    default_store.set_cache_impl(original_cache)
