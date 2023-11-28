from datetime import datetime, timedelta

import pytest
from django.conf import settings

from sentry.sentry_metrics.indexer.cache import StringIndexerCache
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.testutils.helpers.options import override_options
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
    with override_options(
        {
            "sentry-metrics.indexer.read-new-cache-namespace": False,
            "sentry-metrics.indexer.write-new-cache-namespace": False,
        }
    ):
        cache.clear()
        namespace = "test"
        assert indexer_cache.get(namespace, f"{use_case_id}:1:blah:123") is None
        indexer_cache.set(namespace, f"{use_case_id}:1:blah:123", 1)
        assert indexer_cache.get(namespace, f"{use_case_id}:1:blah:123") == 1

        indexer_cache.delete(namespace, f"{use_case_id}:1:blah:123")
        assert indexer_cache.get(namespace, f"{use_case_id}:1:blah:123") is None

    with override_options(
        {
            "sentry-metrics.indexer.read-new-cache-namespace": False,
            "sentry-metrics.indexer.write-new-cache-namespace": True,
        }
    ):
        cache.clear()
        namespace = "test"
        assert indexer_cache.get(namespace, f"{use_case_id}:1:blah:123") is None
        indexer_cache.set(namespace, f"{use_case_id}:1:blah:123", 1)
        assert indexer_cache.get(namespace, f"{use_case_id}:1:blah:123") == 1

        indexer_cache.delete(namespace, f"{use_case_id}:1:blah:123")
        assert indexer_cache.get(namespace, f"{use_case_id}:1:blah:123") is None

    with override_options(
        {
            "sentry-metrics.indexer.read-new-cache-namespace": True,
            "sentry-metrics.indexer.write-new-cache-namespace": True,
        }
    ):
        cache.clear()
        namespace = "test"
        assert indexer_cache.get(namespace, f"{use_case_id}:1:blah:123") is None
        indexer_cache.set(namespace, f"{use_case_id}:1:blah:123", 1)
        assert indexer_cache.get(namespace, f"{use_case_id}:1:blah:123") == 1

        indexer_cache.delete(namespace, f"{use_case_id}:1:blah:123")
        assert indexer_cache.get(namespace, f"{use_case_id}:1:blah:123") is None

    with override_options(
        {
            "sentry-metrics.indexer.read-new-cache-namespace": True,
            "sentry-metrics.indexer.write-new-cache-namespace": True,
        }
    ):
        cache.clear()
        namespace_1 = "1"
        namespace_2 = "2"
        assert indexer_cache.get(namespace_1, f"{use_case_id}:1:blah:123") is None
        indexer_cache.set(namespace_1, f"{use_case_id}:1:blah:123", 1)
        assert indexer_cache.get(namespace_1, f"{use_case_id}:1:blah:123") == 1

        indexer_cache.delete(namespace_1, f"{use_case_id}:1:blah:123")
        assert indexer_cache.get(namespace_1, f"{use_case_id}:1:blah:123") is None

        assert indexer_cache.get(namespace_2, f"{use_case_id}:1:blah:123") is None
        indexer_cache.set(namespace_2, f"{use_case_id}:1:blah:123", 2)
        assert indexer_cache.get(namespace_2, f"{use_case_id}:1:blah:123") == 2

        indexer_cache.delete(namespace_2, f"{use_case_id}:1:blah:123")
        assert indexer_cache.get(namespace_2, f"{use_case_id}:1:blah:123") is None


def test_cache_validate_stale_timestamp():
    with override_options(
        {
            "sentry-metrics.indexer.read-new-cache-namespace": True,
            "sentry-metrics.indexer.write-new-cache-namespace": True,
        }
    ):
        namespace = "test"
        key = "spans:1:key"
        cache.clear()
        cache.set(
            indexer_cache._make_namespaced_cache_key(namespace, key),
            indexer_cache._make_cache_val(1, 0),
        )
        assert indexer_cache.get_many(namespace, [key]) == {key: None}

        indexer_cache.set_many(namespace, {key: 1})
        assert indexer_cache.get_many(namespace, [key]) == {key: 1}


def test_cache_many(use_case_id: str) -> None:
    with override_options(
        {
            "sentry-metrics.indexer.read-new-cache-namespace": False,
            "sentry-metrics.indexer.write-new-cache-namespace": False,
        }
    ):
        cache.clear()
        namespace = "test"
        values = {f"{use_case_id}:100:hello": 2, f"{use_case_id}:100:bye": 3}
        assert indexer_cache.get_many(namespace, values.keys()) == {
            f"{use_case_id}:100:hello": None,
            f"{use_case_id}:100:bye": None,
        }
        indexer_cache.set_many(namespace, values)
        assert indexer_cache.get_many(namespace, list(values.keys())) == values

        indexer_cache.delete_many(namespace, list(values.keys()))
        assert indexer_cache.get_many(namespace, values.keys()) == {
            f"{use_case_id}:100:hello": None,
            f"{use_case_id}:100:bye": None,
        }


def test_make_cache_key(use_case_id: str) -> None:
    with override_options(
        {
            "sentry-metrics.indexer.read-new-cache-namespace": False,
            "sentry-metrics.indexer.write-new-cache-namespace": False,
        }
    ):
        cache.clear()
        namespace = "test"
        orgId = 1
        string = ":blah:blah"
        key = indexer_cache._make_cache_key(f"{use_case_id}:{orgId}:{string}")

        hashed = md5_text(f"{orgId}:{string}").hexdigest()

        assert key == f"indexer:test:org:str:{use_case_id}:{hashed}"

    with override_options(
        {
            "sentry-metrics.indexer.read-new-cache-namespace": True,
            "sentry-metrics.indexer.write-new-cache-namespace": False,
        }
    ):
        cache.clear()
        namespace = "test"
        orgId = 1
        string = ":blah:blah"
        key = indexer_cache._make_namespaced_cache_key(namespace, f"{use_case_id}:{orgId}:{string}")

        hashed = md5_text(f"{orgId}:{string}").hexdigest()

        assert key == f"indexer:test:{namespace}:org:str:{use_case_id}:{hashed}"


def test_formatted_results(use_case_id: str) -> None:
    with override_options(
        {
            "sentry-metrics.indexer.read-new-cache-namespace": False,
            "sentry-metrics.indexer.write-new-cache-namespace": False,
        }
    ):
        cache.clear()
        namespace = "test"
        values = {f"{use_case_id}:1:::hello": 2, f"{use_case_id}:1:::bye": 3}
        results = {indexer_cache._make_cache_key(k): v for k, v in values.items()}
        assert indexer_cache._format_results(list(values.keys()), results) == values

    with override_options(
        {
            "sentry-metrics.indexer.read-new-cache-namespace": True,
            "sentry-metrics.indexer.write-new-cache-namespace": False,
        }
    ):
        cache.clear()
        namespace = "test"
        values = {
            f"{namespace}:{use_case_id}:1:::hello": 2,
            f"{namespace}:{use_case_id}:1:::bye": 3,
        }
        results = {
            indexer_cache._make_namespaced_cache_key(namespace, k): v for k, v in values.items()
        }
        assert (
            indexer_cache._format_namespaced_results(namespace, list(values.keys()), results)
            == values
        )


def test_ttl_jitter() -> None:
    base_ttl = 3600 * 2
    max_ttl = base_ttl + 1800  # 25% of base_ttl

    ttl_1 = indexer_cache.randomized_ttl
    assert base_ttl <= ttl_1 <= max_ttl

    ttl_2 = indexer_cache.randomized_ttl
    assert base_ttl <= ttl_2 <= max_ttl

    assert not ttl_1 == ttl_2


def test_separate_namespacing() -> None:
    with override_options(
        {
            "sentry-metrics.indexer.read-new-cache-namespace": False,
            "sentry-metrics.indexer.write-new-cache-namespace": False,
        }
    ):
        namespace = "test"
        indexer_cache.set(namespace, "sessions:3:what", 1)
        assert indexer_cache.get(namespace, "sessions:3:what") == 1
        indexer_cache.set(namespace, "transactions:3:what", 2)
        assert indexer_cache.get(namespace, "sessions:3:what") == 1
        assert indexer_cache.get(namespace, "transactions:3:what") == 2


def test_is_valid_timestamp() -> None:
    stale_ts = int((datetime.utcnow() - timedelta(hours=5)).timestamp())
    new_ts = int((datetime.utcnow() - timedelta(hours=1)).timestamp())

    assert not indexer_cache._is_valid_timestamp(str(stale_ts))
    assert indexer_cache._is_valid_timestamp(str(new_ts))
