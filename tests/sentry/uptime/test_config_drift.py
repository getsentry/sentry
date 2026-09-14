from __future__ import annotations

from unittest import mock
from uuid import UUID, uuid4

from django.db import connections, router
from django.test import override_settings
from django.test.utils import CaptureQueriesContext

from sentry.conf.types.uptime import UptimeRegionConfig
from sentry.testutils.cases import UptimeTestCase
from sentry.uptime.config_drift import (
    ConfigDriftReading,
    ConfigStore,
    check_config_drift,
    find_config_drift,
    get_config_stores,
    iter_expected_rows,
    missing_config_pairs,
)
from sentry.uptime.config_producer import (
    get_config_key,
    get_partition_from_subscription_id,
    produce_config,
)
from sentry.uptime.models import UptimeSubscription, UptimeSubscriptionRegion
from sentry.uptime.subscriptions.tasks import (
    config_drift_checker,
    uptime_subscription_to_check_config,
)
from sentry.utils import redis

REGIONS = [
    UptimeRegionConfig(slug="a1", name="A1", config_redis_key_prefix="a"),
    UptimeRegionConfig(slug="a2", name="A2", config_redis_key_prefix="a"),
    UptimeRegionConfig(slug="b1", name="B1", config_redis_key_prefix="b"),
]
STORE_A = ConfigStore(cluster="default", key_prefix="a", region_slugs=frozenset({"a1", "a2"}))
STORE_B = ConfigStore(cluster="default", key_prefix="b", region_slugs=frozenset({"b1"}))


def test_get_config_stores_groups_slugs_by_cluster_and_prefix() -> None:
    assert get_config_stores(REGIONS) == [STORE_A, STORE_B]


def _drift(
    stored: dict[ConfigStore, set[str]],
    expected_rows: list[tuple[str, str]],
    null_rows: list[tuple[int, str]] | None = None,
) -> dict[ConfigStore, ConfigDriftReading]:
    readings = find_config_drift(stored, expected_rows, null_rows or [])
    return {reading.store: reading for reading in readings}


def test_find_config_drift_missing_on_one_store_only() -> None:
    readings = _drift({STORE_A: {"s1"}, STORE_B: set()}, [("s1", "a1"), ("s1", "b1")])
    assert readings[STORE_A].missing == set()
    assert readings[STORE_B].missing == {"s1"}


def test_find_config_drift_sibling_slug_counts_as_present() -> None:
    readings = _drift({STORE_A: {"s1"}, STORE_B: set()}, [("s1", "a2")])
    assert readings[STORE_A] == ConfigDriftReading(
        store=STORE_A, expected=1, stored=1, missing=set(), orphaned=set(), null_subscription_ids=0
    )


def test_find_config_drift_ignores_unknown_slug() -> None:
    readings = _drift({STORE_A: set(), STORE_B: set()}, [("s1", "unknown")], [(7, "unknown")])
    assert readings[STORE_A].expected == 0
    assert readings[STORE_A].null_subscription_ids == 0
    assert readings[STORE_B].expected == 0
    assert readings[STORE_B].null_subscription_ids == 0


def test_missing_config_pairs() -> None:
    readings = _drift({STORE_A: {"s1"}, STORE_B: set()}, [("s1", "a1"), ("s1", "b1"), ("s2", "a2")])
    assert missing_config_pairs(readings.values()) == {("s1", "default"), ("s2", "default")}


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


@override_settings(UPTIME_REGIONS=REGIONS)
class CheckConfigDriftTest(UptimeTestCase):
    def test_check_config_drift(self) -> None:
        published = self.create_uptime_subscription(
            subscription_id=uuid4().hex, region_slugs=["a1", "b1"]
        )
        _publish(published, ["a1", "b1"])
        sibling_only = self.create_uptime_subscription(
            subscription_id=uuid4().hex, region_slugs=["a2"]
        )
        _publish(sibling_only, ["a2"])
        lost_on_b_id = uuid4().hex
        lost_on_b = self.create_uptime_subscription(
            subscription_id=lost_on_b_id, region_slugs=["a1", "b1"]
        )
        _publish(lost_on_b, ["a1"])
        self.create_uptime_subscription(
            subscription_id=uuid4().hex,
            status=UptimeSubscription.Status.DISABLED,
            region_slugs=["a1"],
        )
        self.create_uptime_subscription(
            subscription_id=uuid4().hex,
            status=UptimeSubscription.Status.DELETING,
            region_slugs=["a1"],
        )
        self.create_uptime_subscription(
            subscription_id=uuid4().hex,
            status=UptimeSubscription.Status.CREATING,
            region_slugs=["a1"],
        )
        self.create_uptime_subscription(region_slugs=["a1", "a2"])

        orphan_id = uuid4().hex
        cluster = redis.redis_clusters.get_binary("default")
        partition = get_partition_from_subscription_id(UUID(orphan_id))
        cluster.hset(get_config_key("b", partition), orphan_id, b"")

        readings = {reading.store: reading for reading in check_config_drift()}
        assert readings[STORE_A] == ConfigDriftReading(
            store=STORE_A,
            expected=3,
            stored=3,
            missing=set(),
            orphaned=set(),
            null_subscription_ids=1,
        )
        assert readings[STORE_B] == ConfigDriftReading(
            store=STORE_B,
            expected=2,
            stored=2,
            missing={lost_on_b_id},
            orphaned={orphan_id},
            null_subscription_ids=0,
        )

    def test_expected_rows_read_only_id_and_slug_from_replica(self) -> None:
        subscription = self.create_uptime_subscription(
            subscription_id=uuid4().hex, region_slugs=["a1"]
        )
        db = UptimeSubscriptionRegion.objects.using_replica().db

        with (
            mock.patch.object(router, "db_for_read", wraps=router.db_for_read) as db_for_read,
            CaptureQueriesContext(connections[db]) as queries,
        ):
            assert list(iter_expected_rows()) == [(subscription.subscription_id, "a1")]

        db_for_read.assert_any_call(UptimeSubscriptionRegion, replica=True)
        region_queries = [
            q["sql"]
            for q in queries.captured_queries
            if "uptime_uptimesubscriptionregion" in q["sql"]
        ]
        assert region_queries
        for sql in region_queries:
            select_clause = sql.removeprefix("SELECT ").split(" FROM ")[0]
            columns = [column.split(" AS ")[0] for column in select_clause.split(", ")]
            assert columns == [
                '"uptime_uptimesubscriptionregion"."id"',
                '"uptime_uptimesubscription"."subscription_id"',
                '"uptime_uptimesubscriptionregion"."region_slug"',
            ], sql


@override_settings(UPTIME_REGIONS=REGIONS)
class ConfigDriftCheckerTest(UptimeTestCase):
    @mock.patch("sentry.uptime.subscriptions.tasks.metrics")
    def test_emits_gauges_per_store(self, mock_metrics: mock.MagicMock) -> None:
        lost_on_b = self.create_uptime_subscription(
            subscription_id=uuid4().hex, region_slugs=["a1", "b1"]
        )
        _publish(lost_on_b, ["a1"])
        self.create_uptime_subscription(region_slugs=["a1"])

        config_drift_checker()

        tags = {"cluster": "default"}
        assert mock_metrics.gauge.mock_calls == [
            mock.call("uptime.config_drift.missing", 0, tags=tags, sample_rate=1.0),
            mock.call("uptime.config_drift.orphaned", 0, tags=tags, sample_rate=1.0),
            mock.call("uptime.config_drift.null_subscription_id", 1, tags=tags, sample_rate=1.0),
            mock.call("uptime.config_drift.missing", 1, tags=tags, sample_rate=1.0),
            mock.call("uptime.config_drift.orphaned", 0, tags=tags, sample_rate=1.0),
            mock.call("uptime.config_drift.null_subscription_id", 0, tags=tags, sample_rate=1.0),
        ]

    def test_writes_nothing_to_postgres(self) -> None:
        never_published = self.create_uptime_subscription(region_slugs=["a1"])
        db = UptimeSubscriptionRegion.objects.using_replica().db

        with CaptureQueriesContext(connections[db]) as queries:
            config_drift_checker()

        assert queries.captured_queries
        writes = [
            q["sql"]
            for q in queries.captured_queries
            if q["sql"].startswith(("INSERT", "UPDATE", "DELETE"))
        ]
        assert writes == []
        never_published.refresh_from_db()
        assert never_published.subscription_id is None

    def test_writes_nothing_to_redis(self) -> None:
        published = self.create_uptime_subscription(
            subscription_id=uuid4().hex, region_slugs=["a1"]
        )
        _publish(published, ["a1"])
        cluster = redis.redis_clusters.get_binary("default")
        before = {key: cluster.hgetall(key) for key in cluster.keys(b"*uptime:*")}
        assert before

        config_drift_checker()

        assert {key: cluster.hgetall(key) for key in cluster.keys(b"*uptime:*")} == before
