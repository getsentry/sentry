from __future__ import annotations

import math
from datetime import UTC, datetime, timedelta
from unittest import mock
from uuid import UUID, uuid4

from django.db import connections, router
from django.test import override_settings
from django.test.utils import CaptureQueriesContext
from rediscluster.nodemanager import NodeManager

from sentry.conf.types.uptime import UptimeRegionConfig
from sentry.testutils.cases import UptimeTestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.datetime import freeze_time
from sentry.uptime.config_drift import get_sentinel_key
from sentry.uptime.config_producer import (
    get_config_key,
    get_partition_from_subscription_id,
    produce_config,
)
from sentry.uptime.models import UptimeSubscription, UptimeSubscriptionRegion
from sentry.uptime.subscriptions import tasks
from sentry.uptime.subscriptions.tasks import (
    check_config_sentinels,
    check_missing_configs,
    check_orphaned_configs,
    config_drift_dispatcher,
    repair_config_store,
    update_remote_uptime_subscription,
    uptime_subscription_to_check_config,
)
from sentry.utils import redis
from tests.sentry.uptime.subscriptions.test_tasks import ConfigPusherTestMixin

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
            assert sorted(prefixes) == [
                ("default", p, f"{bucket:02x}") for p in "ab" for bucket in range(256)
            ]
            assert sorted(partitions) == [("default", p, i) for p in "ab" for i in range(128)]

    def _run_one_cycle(
        self, cycle_hours: int, missing_delay: mock.MagicMock, orphaned_delay: mock.MagicMock
    ) -> tuple[list[tuple[str, str, str]], list[tuple[str, str, int]]]:
        prefixes: list[tuple[str, str, str]] = []
        partitions: list[tuple[str, str, int]] = []
        with override_options(
            {"uptime.config-drift.enabled": True, "uptime.config-drift.cycle-hours": cycle_hours}
        ):
            for hour in range(cycle_hours):
                with freeze_time(EPOCH + timedelta(hours=hour, minutes=5)):
                    config_drift_dispatcher()
                run_prefixes = [
                    (
                        c.kwargs["cluster"],
                        c.kwargs["key_prefix"],
                        c.kwargs["subscription_id_prefix"],
                    )
                    for c in missing_delay.mock_calls
                ]
                # Spread across the cycle, not front-loaded into one run; one task per store.
                assert len(run_prefixes) <= math.ceil(256 / cycle_hours) * 2
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
class CheckMissingConfigsTest(ConfigPusherTestMixin):
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
            check_missing_configs(subscription_id_prefix=PREFIX, cluster="default", key_prefix="a")
            check_missing_configs(subscription_id_prefix=PREFIX, cluster="default", key_prefix="b")

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
            check_missing_configs(subscription_id_prefix=PREFIX, cluster="default", key_prefix="a")

        db_for_read.assert_any_call(UptimeSubscriptionRegion, replica=True)
        region_queries = [
            q["sql"]
            for q in queries.captured_queries
            if "uptime_uptimesubscriptionregion" in q["sql"]
        ]
        assert len(region_queries) == 1
        select_clause = region_queries[0].removeprefix("SELECT ").split(" FROM ")[0]
        columns = [column.split(" AS ")[0] for column in select_clause.split(", ")]
        assert columns == ['"uptime_uptimesubscription"."subscription_id"'], region_queries[0]

    def _seed_lost_on_b(self) -> tuple[UptimeSubscription, UptimeSubscription]:
        published = self.create_uptime_subscription(
            subscription_id=_subscription_id(), region_slugs=["a1", "b1"]
        )
        _publish(published, ["a1", "b1"])
        lost_on_b = self.create_uptime_subscription(
            subscription_id=_subscription_id(), region_slugs=["a1", "b1"]
        )
        _publish(lost_on_b, ["a1"])
        return published, lost_on_b

    def test_repair_option_off_publishes_nothing(self) -> None:
        _, lost_on_b = self._seed_lost_on_b()

        with mock.patch.object(update_remote_uptime_subscription, "delay") as delay:
            check_missing_configs(subscription_id_prefix=PREFIX, cluster="default", key_prefix="b")

        assert not delay.called
        self.assert_redis_config("b1", lost_on_b, None, None)

    @override_options({"uptime.config-drift.repair": True})
    def test_repairs_only_missing_and_keeps_status(self) -> None:
        published, lost_on_b = self._seed_lost_on_b()
        assert lost_on_b.status == UptimeSubscription.Status.ACTIVE.value

        with (
            mock.patch.object(tasks, "metrics") as metrics,
            self.tasks(),
            mock.patch.object(
                update_remote_uptime_subscription,
                "delay",
                wraps=update_remote_uptime_subscription.delay,
            ) as delay,
        ):
            check_missing_configs(subscription_id_prefix=PREFIX, cluster="default", key_prefix="b")

        delay.assert_called_once_with(uptime_subscription_id=lost_on_b.id, region_slugs=["b1"])
        self.assert_redis_config(
            "b1", lost_on_b, "upsert", UptimeSubscriptionRegion.RegionMode.ACTIVE
        )
        for sub in (published, lost_on_b):
            sub.refresh_from_db()
            assert sub.status == UptimeSubscription.Status.ACTIVE.value
        metrics.incr.assert_any_call(
            "uptime.config_repair.queued", amount=1, tags={"cluster": "default"}, sample_rate=1.0
        )

    @override_options({"uptime.config-drift.repair": True})
    def test_second_run_queues_nothing(self) -> None:
        self._seed_lost_on_b()
        with self.tasks():
            check_missing_configs(subscription_id_prefix=PREFIX, cluster="default", key_prefix="b")

        with mock.patch.object(update_remote_uptime_subscription, "delay") as delay:
            check_missing_configs(subscription_id_prefix=PREFIX, cluster="default", key_prefix="b")

        assert not delay.called


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
        # Mid-update: its config is legitimately in Redis while the row is not ACTIVE.
        updating = self.create_uptime_subscription(
            subscription_id=same_partition_id(),
            status=UptimeSubscription.Status.UPDATING,
            region_slugs=["b1"],
        )
        _publish(updating, ["b1"])

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
            mock.call("uptime.config_drift.checked", amount=5, tags=ORPHANED_TAGS, sample_rate=1.0),
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
            check_missing_configs(subscription_id_prefix=PREFIX, cluster="default", key_prefix="a")
            check_orphaned_configs(cluster="default", key_prefix="a", partition=partition)

        writes = [
            q["sql"]
            for q in queries.captured_queries
            if q["sql"].startswith(("INSERT", "UPDATE", "DELETE"))
        ]
        assert writes == []


def test_sentinel_shares_slot_with_partition_hash() -> None:
    # Offline slot math; the node is never contacted.
    keyslot = NodeManager(startup_nodes=[{"host": "localhost", "port": 1}]).keyslot
    for key_prefix in ("", "a"):
        for partition in range(128):
            assert keyslot(get_sentinel_key(key_prefix, partition)) == keyslot(
                get_config_key(key_prefix, partition)
            )


@override_settings(UPTIME_REGIONS=REGIONS)
class CheckConfigSentinelsTest(ConfigPusherTestMixin):
    def setUp(self) -> None:
        super().setUp()
        self.enterContext(override_options({"uptime.config-drift.enabled": True}))

    def test_sentinel_repair_disabled_emits_metric_only(self) -> None:
        cluster = redis.redis_clusters.get_binary("default")
        keys_before = set(cluster.keys())

        with (
            mock.patch.object(tasks, "metrics") as metrics,
            mock.patch.object(repair_config_store, "delay") as delay,
        ):
            check_config_sentinels()

        # One gauge per store, both on the test cluster.
        all_missing = mock.call(
            "uptime.config_drift.sentinel_missing",
            128,
            tags={"cluster": "default"},
            sample_rate=1.0,
        )
        assert metrics.gauge.mock_calls == [all_missing, all_missing]
        assert metrics.incr.mock_calls == []
        assert not delay.called
        assert set(cluster.keys()) == keys_before

    @override_options({"uptime.config-drift.sentinel-repair-disabled": False})
    def test_sentinel_write_touches_no_config_hash(self) -> None:
        cluster = redis.redis_clusters.get_binary("default")

        with self.tasks():
            check_config_sentinels()

        for key_prefix in "ab":
            for partition in range(128):
                assert cluster.type(get_sentinel_key(key_prefix, partition)) == b"string"
                assert not cluster.exists(get_config_key(key_prefix, partition))
                assert not cluster.exists(f"{key_prefix}uptime:updates:{partition}")

    def _seed_lost_on_b(self, count: int = 1) -> tuple[list[UptimeSubscription], str]:
        """
        Writes every sentinel, then creates ``count`` subscriptions never published to store B
        and drops one of their partitions' sentinel there. Returns them and the lost sentinel key.
        """
        with self.tasks():
            check_config_sentinels()
        subscriptions = []
        for _ in range(count):
            subscription = self.create_uptime_subscription(
                subscription_id=_subscription_id(), region_slugs=["a1", "b1"]
            )
            _publish(subscription, ["a1"])
            subscriptions.append(subscription)
        assert subscription.subscription_id is not None
        partition = get_partition_from_subscription_id(UUID(subscription.subscription_id))
        sentinel = get_sentinel_key("b", partition)
        redis.redis_clusters.get_binary("default").delete(sentinel)
        return subscriptions, sentinel

    @override_options({"uptime.config-drift.sentinel-repair-disabled": False})
    def test_missing_sentinel_repairs_only_that_store(self) -> None:
        [subscription], _ = self._seed_lost_on_b()

        with mock.patch.object(repair_config_store, "delay") as delay:
            check_config_sentinels()
        delay.assert_called_once_with(cluster="default", key_prefix="b")

        with self.tasks():
            repair_config_store(cluster="default", key_prefix="b")

        self.assert_redis_config(
            "b1", subscription, "upsert", UptimeSubscriptionRegion.RegionMode.ACTIVE
        )

    @override_options({"uptime.config-drift.sentinel-repair-disabled": False})
    @mock.patch.object(tasks, "CONFIG_REPAIR_MAX_TASKS", 1)
    def test_unpublishable_configs_end_the_pass(self) -> None:
        lost, sentinel = self._seed_lost_on_b(count=2)
        first, second = sorted(lost, key=lambda subscription: subscription.subscription_id or "")
        cluster = redis.redis_clusters.get_binary("default")

        # The republishes never land, so both stay missing on every run.
        with mock.patch.object(update_remote_uptime_subscription, "delay") as delay:
            repair_config_store(cluster="default", key_prefix="b")
            assert not cluster.exists(sentinel)
            repair_config_store(cluster="default", key_prefix="b")

        assert delay.call_args_list == [
            mock.call(uptime_subscription_id=first.id, region_slugs=["b1"]),
            mock.call(uptime_subscription_id=second.id, region_slugs=["b1"]),
        ]
        assert cluster.exists(sentinel)

        with mock.patch.object(repair_config_store, "delay") as repair:
            check_config_sentinels()
        assert not repair.called
