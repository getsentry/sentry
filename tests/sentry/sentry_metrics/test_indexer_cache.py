from functools import wraps

from sentry.sentry_metrics.indexer.cache import indexer_cache
from sentry.utils.hashlib import md5_text

TEST_KEYS = ["blah", "hello", "bye"]


def clear_cache(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        indexer_cache.delete_many(TEST_KEYS)
        result = func(*args, **kwargs)
        return result

    return wrapper


@clear_cache
def test_cache() -> None:
    assert indexer_cache.get("blah") is None
    indexer_cache.set("blah", 1)
    assert indexer_cache.get("blah") == 1

    indexer_cache.delete("blah")
    assert indexer_cache.get("blah") is None


@clear_cache
def test_cache_many() -> None:
    values = {"hello": 2, "bye": 3}
    assert indexer_cache.get_many(list(values.keys())) == {"hello": None, "bye": None}
    indexer_cache.set_many(values)
    assert indexer_cache.get_many(list(values.keys())) == values

    indexer_cache.delete_many(list(values.keys()))
    assert indexer_cache.get_many(list(values.keys())) == {"hello": None, "bye": None}


def test_make_cache_key() -> None:
    key = indexer_cache.make_cache_key("blah")
    assert key == f"indexer:org:str:{md5_text('blah').hexdigest()}"


def test_formatted_results() -> None:
    values = {"hello": 2, "bye": 3}
    results = {indexer_cache.make_cache_key(k): v for k, v in values.items()}
    assert indexer_cache._format_results(list(values.keys()), results) == values


def test_ttl_jitter() -> None:
    base_ttl = 3600 * 2
    max_ttl = base_ttl + 1800  # 25% of base_ttl

    ttl_1 = indexer_cache.randomized_ttl
    assert base_ttl <= ttl_1 <= max_ttl

    ttl_2 = indexer_cache.randomized_ttl
    assert base_ttl <= ttl_2 <= max_ttl

    assert not ttl_1 == ttl_2
