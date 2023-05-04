import pytest
from django.conf import settings

from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.indexer.cache import StringIndexerCache
from sentry.utils.cache import cache
from sentry.utils.hashlib import md5_text

pytestmark = pytest.mark.sentry_metrics

_PARTITION_KEY = "test"

indexer_cache = StringIndexerCache(
    **settings.SENTRY_STRING_INDEXER_CACHE_OPTIONS, partition_key=_PARTITION_KEY
)


@pytest.fixture
def use_case_id() -> str:
    return UseCaseKey.RELEASE_HEALTH.value


def test_cache(use_case_id: str) -> None:
    cache.clear()
    assert indexer_cache.get("blah", use_case_id) is None
    indexer_cache.set("blah", 1, use_case_id)
    assert indexer_cache.get("blah", use_case_id) == 1

    indexer_cache.delete("blah", use_case_id)
    assert indexer_cache.get("blah", use_case_id) is None


def test_cache_many(use_case_id: str) -> None:
    cache.clear()
    values = {"hello": 2, "bye": 3}
    assert indexer_cache.get_many(list(values.keys()), use_case_id) == {"hello": None, "bye": None}
    indexer_cache.set_many(values, use_case_id)
    assert indexer_cache.get_many(list(values.keys()), use_case_id) == values

    indexer_cache.delete_many(list(values.keys()), use_case_id)
    assert indexer_cache.get_many(list(values.keys()), use_case_id) == {"hello": None, "bye": None}


def test_make_cache_key(use_case_id: str) -> None:
    key = indexer_cache.make_cache_key("blah", "release-health")
    assert key == f"indexer:test:org:str:{use_case_id}:{md5_text('blah').hexdigest()}"


def test_formatted_results(use_case_id: str) -> None:
    values = {"hello": 2, "bye": 3}
    results = {indexer_cache.make_cache_key(k, use_case_id): v for k, v in values.items()}
    assert indexer_cache._format_results(list(values.keys()), results, use_case_id) == values


def test_ttl_jitter() -> None:
    base_ttl = 3600 * 2
    max_ttl = base_ttl + 1800  # 25% of base_ttl

    ttl_1 = indexer_cache.randomized_ttl
    assert base_ttl <= ttl_1 <= max_ttl

    ttl_2 = indexer_cache.randomized_ttl
    assert base_ttl <= ttl_2 <= max_ttl

    assert not ttl_1 == ttl_2


def test_separate_namespacing() -> None:
    indexer_cache.set("a", 1, UseCaseKey.RELEASE_HEALTH.value)
    assert indexer_cache.get("a", UseCaseKey.RELEASE_HEALTH.value) == 1
    indexer_cache.set("a", 2, UseCaseKey.PERFORMANCE.value)
    assert indexer_cache.get("a", UseCaseKey.RELEASE_HEALTH.value) == 1
    assert indexer_cache.get("a", UseCaseKey.PERFORMANCE.value) == 2
