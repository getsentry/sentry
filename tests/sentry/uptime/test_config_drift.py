from __future__ import annotations

import math
from datetime import UTC, datetime, timedelta
from unittest import mock
from uuid import UUID, uuid4

from django.db import connections, router
from django.test import override_settings
from django.test.utils import CaptureQueriesContext

from sentry.conf.types.uptime import UptimeRegionConfig
from sentry.testutils.cases import UptimeTestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.datetime import freeze_time
from sentry.uptime.config_producer import (
    get_config_key,
    get_partition_from_subscription_id,
    produce_config,
)
from sentry.uptime.models import UptimeSubscription, UptimeSubscriptionRegion
from sentry.uptime.subscriptions import tasks
from sentry.uptime.subscriptions.tasks import (
    check_missing_configs,
    check_orphaned_configs,
    config_drift_dispatcher,
    uptime_subscription_to_check_config,
)
from sentry.utils import redis

# a1 and a2 share a store (same cluster and key prefix); b1 is a second store.
REGIONS = [
    UptimeRegionConfig(slug="a1", name="A1", config_redis_key_prefix="a"),
    UptimeRegionConfig(slug="a2", name="A2", config_redis_key_prefix="a"),
    UptimeRegionConfig(slug="b1", name="B1", config_redis_key_prefix="b"),
]
PREFIX = "ab"
EPOCH = datetime(2020, 1, 1, tzinfo=UTC)
MISSING_TAGS = {"cluster": "default", "direction": "missing"}
ORPHANED_TAGS = {"cluster": "default", "direction": "orphaned"}


def _subscription_id(prefix: str = PREFIX) -> str:
    return prefix + uuid4().hex[len(prefix) :]


def _publish(subscription: UptimeSubscription, region_slugs: list[str]) -> None:
    assert subscription.subscription_id is not None
    for region_slug in region_slugs:
        produce_config(
            region_slug,
            uptime_subscription_to_check_config(
                subscription,
                subscription.subscription_id,
                UptimeSubscriptionRegion.RegionMode.ACTIVE,
            ),
        )


def _hset_raw(key_prefix: str, subscription_id: str) -> None:
    cluster = redis.redis_clusters.get_binary("default")
    partition = get_partition_from_subscription_id(UUID(subscription_id))
    cluster.hset(get_config_key(key_prefix, partition), subscription_id, b"")


@override_settings(UPTIME_REGIONS=REGIONS)
class ConfigDriftDispatcherTest(UptimeTestCase):
    @mock.patch.object(check_orphaned_configs, "delay")
    @mock.patch.object(check_missing_configs, "delay")
    def test_covers_every_prefix_and_partition_once_per_cycle(
        self, missing_delay: mock.MagicMock, orphaned_delay: mock.MagicMock
    ) -> None:
        for cycle_hours in (24, 48):
            prefixes, partitions = self._run_one_cycle(cycle_hours, missing_delay, orphaned_delay)
            assert sorted(prefixes) == [f"{bucket:02x}" for bucket in range(256)]
            assert sorted(partitions) == [("default", p, i) for p in "ab" for i in range(128)]

    def _run_one_cycle(
        self, cycle_hours: int, missing_delay: mock.MagicMock, orphaned_delay: mock.MagicMock
    ) -> tuple[list[str], list[tuple[str, str, int]]]:
        prefixes: list[str] = []
        partitions: list[tuple[str, str, int]] = []
        with override_options(
            {"uptime.config-drift.enabled": True, "uptime.config-drift.cycle-hours": cycle_hours}
        ):
            for hour in range(cycle_hours):
                with freeze_time(EPOCH + timedelta(hours=hour, minutes=5)):
                    config_drift_dispatcher()
                run_prefixes = [
                    c.kwargs["subscription_id_prefix"] for c in missing_delay.mock_calls
                ]
                # Spread across the cycle, not front-loaded into one run.
                assert len(run_prefixes) <= math.ceil(256 / cycle_hours)
                prefixes.extend(run_prefixes)
                partitions.extend(
                    (c.kwargs["cluster"], c.kwargs["key_prefix"], c.kwargs["partition"])
                    for c in orphaned_delay.mock_calls
                )
                missing_delay.reset_mock()
                orphaned_delay.reset_mock()
        return prefixes, partitions

    @override_options({"uptime.config-drift.enabled": False})
    @mock.patch.object(check_orphaned_configs, "delay")
    @mock.patch.object(check_missing_configs, "delay")
    def test_disabled_dispatches_nothing(
        self, missing_delay: mock.MagicMock, orphaned_delay: mock.MagicMock
    ) -> None:
        config_drift_dispatcher()

        assert missing_delay.mock_calls == []
        assert orphaned_delay.mock_calls == []


@override_settings(UPTIME_REGIONS=REGIONS)
class CheckMissingConfigsTest(UptimeTestCase):
    def test_counts_absent_configs_per_store(self) -> None:
        # Two slugs in store A: checked once there, not twice.
        published = self.create_uptime_subscription(
            subscription_id=_subscription_id(), region_slugs=["a1", "a2", "b1"]
        )
        _publish(published, ["a1", "b1"])
        sibling_only = self.create_uptime_subscription(
            subscription_id=_subscription_id(), region_slugs=["a2"]
        )
        _publish(sibling_only, ["a2"])
        lost_on_b = self.create_uptime_subscription(
            subscription_id=_subscription_id(), region_slugs=["a1", "b1"]
        )
        _publish(lost_on_b, ["a1"])
        # Not ACTIVE, and not in this prefix: neither is counted.
        for status in (UptimeSubscription.Status.DISABLED, UptimeSubscription.Status.CREATING):
            self.create_uptime_subscription(
                subscription_id=_subscription_id(), status=status, region_slugs=["a1"]
            )
        self.create_uptime_subscription(subscription_id=_subscription_id("cd"), region_slugs=["a1"])

        with (
            mock.patch.object(tasks, "metrics") as metrics,
            mock.patch.object(tasks.logger, "warning") as warning,
        ):
            check_missing_configs(subscription_id_prefix=PREFIX)

        assert metrics.incr.mock_calls == [
            mock.call("uptime.config_drift.checked", amount=3, tags=MISSING_TAGS, sample_rate=1.0),
            mock.call("uptime.config_drift.missing", amount=0, tags=MISSING_TAGS, sample_rate=1.0),
            mock.call("uptime.config_drift.checked", amount=2, tags=MISSING_TAGS, sample_rate=1.0),
            mock.call("uptime.config_drift.missing", amount=1, tags=MISSING_TAGS, sample_rate=1.0),
        ]
        warning.assert_called_once_with(
            "uptime.config_drift.missing",
            extra={"subscription_id_prefix": PREFIX, "cluster": "default", "count": 1},
        )

    def test_reads_only_subscription_id_from_replica(self) -> None:
        self.create_uptime_subscription(subscription_id=_subscription_id(), region_slugs=["a1"])
        db = UptimeSubscriptionRegion.objects.using_replica().db

        with (
            mock.patch.object(router, "db_for_read", wraps=router.db_for_read) as db_for_read,
            CaptureQueriesContext(connections[db]) as queries,
        ):
            check_missing_configs(subscription_id_prefix=PREFIX)

        db_for_read.assert_any_call(UptimeSubscriptionRegion, replica=True)
        region_queries = [
            q["sql"]
            for q in queries.captured_queries
            if "uptime_uptimesubscriptionregion" in q["sql"]
        ]
        assert len(region_queries) == 2  # one per store
        for sql in region_queries:
            select_clause = sql.removeprefix("SELECT ").split(" FROM ")[0]
            columns = [column.split(" AS ")[0] for column in select_clause.split(", ")]
            assert columns == ['"uptime_uptimesubscription"."subscription_id"'], sql


@override_settings(UPTIME_REGIONS=REGIONS)
class CheckOrphanedConfigsTest(UptimeTestCase):
    def test_counts_unowned_configs_per_store_partition(self) -> None:
        legit_id = _subscription_id()
        partition = get_partition_from_subscription_id(UUID(legit_id))

        # The check reads one hash, so every fixture must land in the same partition.
        def same_partition_id() -> str:
            while True:
                candidate = _subscription_id()
                if get_partition_from_subscription_id(UUID(candidate)) == partition:
                    return candidate

        legit = self.create_uptime_subscription(subscription_id=legit_id, region_slugs=["a1", "b1"])
        _publish(legit, ["a1", "b1"])
        # ACTIVE, but has no region row in store B: its config there is orphaned.
        wrong_region = self.create_uptime_subscription(
            subscription_id=same_partition_id(), region_slugs=["a1"]
        )
        _publish(wrong_region, ["a1", "b1"])
        disabled = self.create_uptime_subscription(
            subscription_id=same_partition_id(),
            status=UptimeSubscription.Status.DISABLED,
            region_slugs=["b1"],
        )
        _publish(disabled, ["b1"])
        _hset_raw("b", same_partition_id())

        with (
            mock.patch.object(tasks, "metrics") as metrics,
            mock.patch.object(tasks.logger, "warning") as warning,
        ):
            check_orphaned_configs(cluster="default", key_prefix="a", partition=partition)
            check_orphaned_configs(cluster="default", key_prefix="b", partition=partition)
            check_orphaned_configs(
                cluster="default", key_prefix="b", partition=(partition + 1) % 128
            )

        assert metrics.incr.mock_calls == [
            mock.call("uptime.config_drift.checked", amount=2, tags=ORPHANED_TAGS, sample_rate=1.0),
            mock.call(
                "uptime.config_drift.orphaned", amount=0, tags=ORPHANED_TAGS, sample_rate=1.0
            ),
            mock.call("uptime.config_drift.checked", amount=4, tags=ORPHANED_TAGS, sample_rate=1.0),
            mock.call(
                "uptime.config_drift.orphaned", amount=3, tags=ORPHANED_TAGS, sample_rate=1.0
            ),
            mock.call("uptime.config_drift.checked", amount=0, tags=ORPHANED_TAGS, sample_rate=1.0),
            mock.call(
                "uptime.config_drift.orphaned", amount=0, tags=ORPHANED_TAGS, sample_rate=1.0
            ),
        ]
        warning.assert_called_once_with(
            "uptime.config_drift.orphaned",
            extra={"partition": partition, "cluster": "default", "count": 3},
        )

    def test_unknown_store_logs_and_returns(self) -> None:
        with (
            mock.patch.object(tasks, "metrics") as metrics,
            mock.patch.object(tasks.logger, "warning") as warning,
        ):
            check_orphaned_configs(cluster="default", key_prefix="zz", partition=0)

        assert metrics.incr.mock_calls == []
        warning.assert_called_once_with(
            "uptime.config_drift.unknown_store", extra={"cluster": "default", "key_prefix": "zz"}
        )


@override_settings(UPTIME_REGIONS=REGIONS)
class ConfigDriftTasksReadOnlyTest(UptimeTestCase):
    @override_options({"uptime.config-drift.enabled": True})
    def test_tasks_write_nothing_to_postgres(self) -> None:
        subscription = self.create_uptime_subscription(
            subscription_id=_subscription_id(), region_slugs=["a1", "b1"]
        )
        _publish(subscription, ["a1"])
        assert subscription.subscription_id is not None
        partition = get_partition_from_subscription_id(UUID(subscription.subscription_id))
        db = UptimeSubscriptionRegion.objects.using_replica().db

        with CaptureQueriesContext(connections[db]) as queries, self.tasks():
            config_drift_dispatcher()
            check_missing_configs(subscription_id_prefix=PREFIX)
            check_orphaned_configs(cluster="default", key_prefix="a", partition=partition)

        writes = [
            q["sql"]
            for q in queries.captured_queries
            if q["sql"].startswith(("INSERT", "UPDATE", "DELETE"))
        ]
        assert writes == []
