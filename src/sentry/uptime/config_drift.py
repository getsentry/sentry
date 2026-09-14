from __future__ import annotations

from collections import defaultdict
from collections.abc import Collection, Iterable, Iterator, Mapping, Sequence
from dataclasses import dataclass

from django.conf import settings
from django.db.models import QuerySet

from sentry.conf.types.uptime import UptimeRegionConfig
from sentry.uptime.config_producer import get_config_key
from sentry.uptime.models import UptimeSubscription, UptimeSubscriptionRegion
from sentry.utils import redis
from sentry.utils.query import RangeQuerySetWrapper


@dataclass(frozen=True)
class ConfigStore:
    cluster: str
    key_prefix: str
    region_slugs: frozenset[str]


@dataclass
class ConfigDriftReading:
    store: ConfigStore
    expected: int
    stored: int
    missing: set[str]
    orphaned: set[str]
    null_subscription_ids: int


def get_config_stores(regions: Sequence[UptimeRegionConfig]) -> list[ConfigStore]:
    # Slugs that share a cluster and key prefix write to the same hashes, so compare them once.
    slugs_by_store: dict[tuple[str, str], set[str]] = defaultdict(set)
    for region in regions:
        slugs_by_store[(region.config_redis_cluster, region.config_redis_key_prefix)].add(
            region.slug
        )
    return [
        ConfigStore(cluster=cluster, key_prefix=key_prefix, region_slugs=frozenset(slugs))
        for (cluster, key_prefix), slugs in slugs_by_store.items()
    ]


def read_stored_subscription_ids(store: ConfigStore) -> set[str]:
    cluster = redis.redis_clusters.get_binary(store.cluster)
    subscription_ids: set[str] = set()
    for partition in range(settings.UPTIME_CONFIG_PARTITIONS):
        key = get_config_key(store.key_prefix, partition)
        subscription_ids.update(field.decode() for field in cluster.hkeys(key))
    return subscription_ids


def _active_region_rows(*, has_subscription_id: bool) -> QuerySet[UptimeSubscriptionRegion]:
    # Inactive and shadow regions still have their config published, so don't filter on mode.
    return UptimeSubscriptionRegion.objects.using_replica().filter(
        uptime_subscription__status=UptimeSubscription.Status.ACTIVE.value,
        uptime_subscription__subscription_id__isnull=not has_subscription_id,
    )


def iter_expected_rows() -> Iterator[tuple[str, str]]:
    queryset = _active_region_rows(has_subscription_id=True).values_list(
        "id", "uptime_subscription__subscription_id", "region_slug"
    )
    for _, subscription_id, region_slug in RangeQuerySetWrapper(
        queryset, result_value_getter=lambda row: row[0]
    ):
        assert subscription_id is not None
        yield subscription_id, region_slug


def iter_null_subscription_rows() -> Iterator[tuple[int, str]]:
    queryset = _active_region_rows(has_subscription_id=False).values_list(
        "id", "uptime_subscription_id", "region_slug"
    )
    for _, uptime_subscription_id, region_slug in RangeQuerySetWrapper(
        queryset, result_value_getter=lambda row: row[0]
    ):
        yield uptime_subscription_id, region_slug


def _group_by_store[V](
    rows: Iterable[tuple[V, str]], stores: Collection[ConfigStore]
) -> dict[ConfigStore, set[V]]:
    store_by_slug = {slug: store for store in stores for slug in store.region_slugs}
    grouped: dict[ConfigStore, set[V]] = {store: set() for store in stores}
    for value, region_slug in rows:
        store = store_by_slug.get(region_slug)
        if store is not None:
            grouped[store].add(value)
    return grouped


def find_config_drift(
    stored: Mapping[ConfigStore, set[str]],
    expected_rows: Iterable[tuple[str, str]],
    null_rows: Iterable[tuple[int, str]],
) -> list[ConfigDriftReading]:
    expected = _group_by_store(expected_rows, stored)
    null_subscriptions = _group_by_store(null_rows, stored)
    return [
        ConfigDriftReading(
            store=store,
            expected=len(expected[store]),
            stored=len(stored_ids),
            missing=expected[store] - stored_ids,
            orphaned=stored_ids - expected[store],
            null_subscription_ids=len(null_subscriptions[store]),
        )
        for store, stored_ids in stored.items()
    ]


def missing_config_pairs(readings: Iterable[ConfigDriftReading]) -> set[tuple[str, str]]:
    return {
        (subscription_id, reading.store.cluster)
        for reading in readings
        for subscription_id in reading.missing
    }


def check_config_drift() -> list[ConfigDriftReading]:
    stored = {
        store: read_stored_subscription_ids(store)
        for store in get_config_stores(settings.UPTIME_REGIONS)
    }
    return find_config_drift(stored, iter_expected_rows(), iter_null_subscription_rows())
