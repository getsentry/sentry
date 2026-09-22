from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from itertools import batched
from uuid import UUID

from django.conf import settings
from django.db.models import QuerySet

from sentry.uptime.config_producer import get_config_key, get_partition_from_subscription_id
from sentry.uptime.models import UptimeSubscription, UptimeSubscriptionRegion
from sentry.utils import redis

# Seconds between dispatcher runs. Must match its crontab in server.py: the slot math and
# the children's expiry both assume one run per interval.
SWEEP_RUN_INTERVAL = 3600
# Two hex chars of a uuid4 subscription_id; uniform, and a range scan on the unique index.
SUBSCRIPTION_ID_PREFIX_BUCKETS = 256
# Bounds the IN list when a partition holds many configs.
IN_CHUNK_SIZE = 1000


@dataclass(frozen=True)
class ConfigStore:
    cluster: str
    key_prefix: str
    region_slugs: frozenset[str]


@dataclass(frozen=True)
class DriftResult:
    checked: int
    drifted_ids: frozenset[str]


def get_config_stores() -> list[ConfigStore]:
    # Slugs that share a cluster and key prefix write to the same hashes, so compare them once.
    slugs_by_store: dict[tuple[str, str], set[str]] = defaultdict(set)
    for region in settings.UPTIME_REGIONS:
        slugs_by_store[(region.config_redis_cluster, region.config_redis_key_prefix)].add(
            region.slug
        )
    return [
        ConfigStore(cluster=cluster, key_prefix=key_prefix, region_slugs=frozenset(slugs))
        for (cluster, key_prefix), slugs in slugs_by_store.items()
    ]


def sweep_slice(total: int, cycle_hours: int, now: datetime) -> range:
    """
    Which of ``total`` units (prefixes or partitions) this run covers, so that consecutive
    runs over ``cycle_hours`` cover all of them exactly once. Derived from the clock rather
    than stored, so the sweep needs no cursor and a rerun of the same hour repeats its slice.
    """
    runs_per_cycle = max(1, cycle_hours * 3600 // SWEEP_RUN_INTERVAL)
    slot = int(now.timestamp()) // SWEEP_RUN_INTERVAL % runs_per_cycle
    return range(slot * total // runs_per_cycle, (slot + 1) * total // runs_per_cycle)


def _active_region_rows() -> QuerySet[UptimeSubscriptionRegion]:
    # Inactive and shadow regions still have their config published, so don't filter on mode.
    return UptimeSubscriptionRegion.objects.using_replica().filter(
        uptime_subscription__status=UptimeSubscription.Status.ACTIVE.value
    )


def _live_region_rows() -> QuerySet[UptimeSubscriptionRegion]:
    # CREATING and UPDATING rows can already have config in Redis, so they aren't orphans.
    return UptimeSubscriptionRegion.objects.using_replica().filter(
        uptime_subscription__status__in=[
            UptimeSubscription.Status.ACTIVE.value,
            UptimeSubscription.Status.CREATING.value,
            UptimeSubscription.Status.UPDATING.value,
        ]
    )


def find_missing_configs(store: ConfigStore, subscription_id_prefix: str) -> DriftResult:
    cluster = redis.redis_clusters.get_binary(store.cluster)
    pipe = cluster.pipeline()
    subscription_ids: list[str] = []
    # One row per (subscription, region); slugs sharing a store must be checked once.
    for subscription_id in set(
        _active_region_rows()
        .filter(
            uptime_subscription__subscription_id__startswith=subscription_id_prefix,
            region_slug__in=store.region_slugs,
        )
        .values_list("uptime_subscription__subscription_id", flat=True)
    ):
        if subscription_id is None:
            continue
        subscription_ids.append(subscription_id)
        partition = get_partition_from_subscription_id(UUID(subscription_id))
        pipe.hexists(get_config_key(store.key_prefix, partition), subscription_id)
    exists = pipe.execute()
    missing_ids = frozenset(
        subscription_id for subscription_id, present in zip(subscription_ids, exists) if not present
    )
    return DriftResult(checked=len(subscription_ids), drifted_ids=missing_ids)


def find_orphaned_configs(store: ConfigStore, partition: int) -> DriftResult:
    cluster = redis.redis_clusters.get_binary(store.cluster)
    stored = {
        field.decode() for field in cluster.hkeys(get_config_key(store.key_prefix, partition))
    }
    live: set[str | None] = set()
    for chunk in batched(stored, IN_CHUNK_SIZE):
        live.update(
            _live_region_rows()
            .filter(
                uptime_subscription__subscription_id__in=chunk,
                region_slug__in=store.region_slugs,
            )
            .values_list("uptime_subscription__subscription_id", flat=True)
        )
    return DriftResult(checked=len(stored), drifted_ids=frozenset(stored - live))
