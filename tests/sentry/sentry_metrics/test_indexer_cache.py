import pytest
from django.conf import settings

from sentry.sentry_metrics.indexer.cache import StringIndexerCache
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.utils.cache import cache
from sentry.utils.hashlib import md5_text

pytestmark = pytest.mark.sentry_metrics

_PARTITION_KEY = "test"

indexer_cache = StringIndexerCache(
    **settings.SENTRY_STRING_INDEXER_CACHE_OPTIONS, partition_key=_PARTITION_KEY
)


@pytest.fixture
def use_case_id() -> str:
    return UseCaseID.SESSIONS.value


def test_cache(use_case_id: str) -> None:
    cache.clear()
    assert indexer_cache.get(f"blah:100:{use_case_id}") is None
    indexer_cache.set(f"blah:100:{use_case_id}", 1)
    assert indexer_cache.get(f"blah:100:{use_case_id}") == 1

    indexer_cache.delete(f"blah:100:{use_case_id}")
    assert indexer_cache.get(f"blah:100:{use_case_id}") is None


def test_cache_many(use_case_id: str) -> None:
    cache.clear()
    values = {f"{use_case_id}:100:hello": 2, f"{use_case_id}:100:bye": 3}
    assert indexer_cache.get_many(values.keys()) == {
        f"{use_case_id}:100:hello": None,
        f"{use_case_id}:100:bye": None,
    }
    indexer_cache.set_many(values)
    assert indexer_cache.get_many(list(values.keys())) == values

    indexer_cache.delete_many(values.keys())
    assert indexer_cache.get_many(values.keys()) == {
        f"{use_case_id}:100:hello": None,
        f"{use_case_id}:100:bye": None,
    }


def test_make_cache_key(use_case_id: str) -> None:
    key = indexer_cache.make_cache_key("sessions:3:blah")
    assert key == f"indexer:test:org:str:{use_case_id}:{md5_text('3:blah').hexdigest()}"


def test_formatted_results(use_case_id: str) -> None:
    values = {"sessions:3:hello": 2, "sessions:4:bye": 3}
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


def test_separate_namespacing() -> None:
    indexer_cache.set("sessions:3:what", 1)
    assert indexer_cache.get("sessions:3:what") == 1
    indexer_cache.set("transactions:3:what", 2)
    assert indexer_cache.get("sessions:3:what") == 1
    assert indexer_cache.get("transactions:3:what") == 2
