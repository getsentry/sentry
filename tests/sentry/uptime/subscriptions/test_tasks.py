from __future__ import annotations

import abc
import uuid
from unittest.mock import patch
from uuid import UUID, uuid4

import msgpack
import pytest
from django.conf import settings
from django.test import override_settings
from django.utils import timezone
from redis import StrictRedis
from rediscluster import RedisCluster

from sentry.conf.types.uptime import UptimeRegionConfig
from sentry.testutils.abstract import Abstract
from sentry.testutils.cases import UptimeTestCase
from sentry.testutils.skips import requires_kafka
from sentry.uptime.config_producer import get_partition_keys
from sentry.uptime.models import UptimeSubscription
from sentry.uptime.subscriptions.regions import get_active_region_configs, get_region_config
from sentry.uptime.subscriptions.tasks import (
    SUBSCRIPTION_STATUS_MAX_AGE,
    create_remote_uptime_subscription,
    delete_remote_uptime_subscription,
    send_uptime_config_deletion,
    subscription_checker,
    update_remote_uptime_subscription,
    uptime_subscription_to_check_config,
)
from sentry.utils import redis

pytestmark = [requires_kafka]


class ConfigPusherTestMixin(UptimeTestCase):
    __test__ = Abstract(__module__, __qualname__)

    def assert_redis_config(
        self,
        region: str,
        sub: UptimeSubscription,
        action: str | None,
    ):
        region_config = get_region_config(region)
        assert region_config is not None
        cluster: RedisCluster | StrictRedis = redis.redis_clusters.get_binary(
            region_config.config_redis_cluster
        )

        assert sub.subscription_id is not None
        config_key, update_key = get_partition_keys(UUID(sub.subscription_id), region_config)
        if action == "upsert":
            config_bytes = cluster.hget(config_key, sub.subscription_id)
            assert config_bytes is not None
            assert msgpack.unpackb(config_bytes) == uptime_subscription_to_check_config(
                sub, sub.subscription_id
            )
        else:
            assert not cluster.hexists(config_key, sub.subscription_id)

        if action is None:
            assert not cluster.hexists(update_key, sub.subscription_id)
        else:
            update_bytes = cluster.hget(update_key, sub.subscription_id)
            assert update_bytes is not None
            assert msgpack.unpackb(update_bytes) == {
                "action": action,
                "subscription_id": sub.subscription_id,
            }


class BaseUptimeSubscriptionTaskTest(ConfigPusherTestMixin, metaclass=abc.ABCMeta):
    __test__ = Abstract(__module__, __qualname__)

    status_translations = {
        UptimeSubscription.Status.CREATING: "create",
        UptimeSubscription.Status.UPDATING: "update",
        UptimeSubscription.Status.DELETING: "delete",
    }

    @pytest.fixture(autouse=True)
    def _setup_metrics(self):
        with patch("sentry.uptime.subscriptions.tasks.metrics") as self.metrics:
            yield

    @abc.abstractproperty
    def expected_status(self):
        pass

    @abc.abstractmethod
    def task(self, uptime_subscription_id: int) -> None:
        pass

    def create_subscription(
        self, status: UptimeSubscription.Status, subscription_id: str | None = None
    ):
        return UptimeSubscription.objects.create(
            status=status.value,
            type="something",
            subscription_id=subscription_id,
            url="http://sentry.io",
            interval_seconds=300,
            timeout_ms=500,
        )

    def test_no_subscription(self):
        self.task(12345)
        self.metrics.incr.assert_called_once_with(
            "uptime.subscriptions.{}.subscription_does_not_exist".format(
                self.status_translations[self.expected_status]
            ),
            sample_rate=1.0,
        )

    def test_invalid_status(self):
        sub = self.create_subscription(
            UptimeSubscription.Status.ACTIVE, subscription_id=uuid.uuid4().hex
        )
        self.task(sub.id)
        self.metrics.incr.assert_called_once_with(
            "uptime.subscriptions.{}.incorrect_status".format(
                self.status_translations[self.expected_status]
            ),
            sample_rate=1.0,
        )
        self.assert_redis_config("default", sub, None)


class CreateUptimeSubscriptionTaskTest(BaseUptimeSubscriptionTaskTest):
    expected_status = UptimeSubscription.Status.CREATING
    task = create_remote_uptime_subscription

    def test(self):
        sub = self.create_subscription(UptimeSubscription.Status.CREATING)
        create_remote_uptime_subscription(sub.id)
        sub.refresh_from_db()
        assert sub.status == UptimeSubscription.Status.ACTIVE.value
        assert sub.subscription_id is not None
        self.assert_redis_config("default", sub, "upsert")

    def test_with_regions(self):
        sub = self.create_uptime_subscription(
            status=UptimeSubscription.Status.CREATING, region_slugs=["default"]
        )
        create_remote_uptime_subscription(sub.id)
        sub.refresh_from_db()
        assert sub.status == UptimeSubscription.Status.ACTIVE.value
        assert sub.subscription_id is not None
        self.assert_redis_config("default", sub, "upsert")

    def test_without_regions_uses_default(self):
        sub = self.create_uptime_subscription(status=UptimeSubscription.Status.CREATING)
        create_remote_uptime_subscription(sub.id)
        sub.refresh_from_db()
        assert sub.status == UptimeSubscription.Status.ACTIVE.value
        assert sub.subscription_id is not None
        self.assert_redis_config("default", sub, "upsert")

    def test_multi_overlapping_regions(self):
        regions = [
            UptimeRegionConfig(
                slug="region1",
                name="Region 1",
                config_redis_cluster=settings.SENTRY_UPTIME_DETECTOR_CLUSTER,
                config_redis_key_prefix="r1",
            ),
            UptimeRegionConfig(
                slug="region2",
                name="Region 2",
                config_redis_cluster=settings.SENTRY_UPTIME_DETECTOR_CLUSTER,
                config_redis_key_prefix="r2",
            ),
            UptimeRegionConfig(
                slug="region3",
                name="Region 3",
                config_redis_cluster=settings.SENTRY_UPTIME_DETECTOR_CLUSTER,
                config_redis_key_prefix="r3",
            ),
        ]
        with override_settings(UPTIME_REGIONS=regions):
            # First subscription with regions 1 and 2
            sub1 = self.create_uptime_subscription(
                status=UptimeSubscription.Status.CREATING, region_slugs=["region1", "region2"]
            )
            create_remote_uptime_subscription(sub1.id)
            sub1.refresh_from_db()

            # Second subscription with regions 2 and 3
            sub2 = self.create_uptime_subscription(
                status=UptimeSubscription.Status.CREATING, region_slugs=["region2", "region3"]
            )
            create_remote_uptime_subscription(sub2.id)
            sub2.refresh_from_db()
            self.assert_redis_config("region1", sub1, "upsert")
            self.assert_redis_config("region2", sub1, "upsert")
            self.assert_redis_config("region2", sub2, "upsert")
            self.assert_redis_config("region3", sub2, "upsert")


class DeleteUptimeSubscriptionTaskTest(BaseUptimeSubscriptionTaskTest):
    expected_status = UptimeSubscription.Status.DELETING
    task = delete_remote_uptime_subscription

    def test(self):
        subscription_id = uuid4().hex
        sub = self.create_subscription(
            UptimeSubscription.Status.DELETING, subscription_id=subscription_id
        )
        delete_remote_uptime_subscription(sub.id)
        assert not UptimeSubscription.objects.filter(id=sub.id).exists()
        self.assert_redis_config("default", sub, "delete")

    def test_no_subscription_id(self):
        sub = self.create_subscription(UptimeSubscription.Status.DELETING)
        assert sub.subscription_id is None
        delete_remote_uptime_subscription(sub.id)
        assert not UptimeSubscription.objects.filter(id=sub.id).exists()

    def test_delete_with_regions(self):
        sub = self.create_uptime_subscription(
            status=UptimeSubscription.Status.DELETING,
            subscription_id=uuid4().hex,
            region_slugs=["default"],
        )
        delete_remote_uptime_subscription(sub.id)
        assert sub.subscription_id is not None
        self.assert_redis_config("default", sub, "delete")
        with pytest.raises(UptimeSubscription.DoesNotExist):
            sub.refresh_from_db()

    def test_delete_without_regions_uses_default(self):
        sub = self.create_uptime_subscription(
            status=UptimeSubscription.Status.DELETING, subscription_id=uuid4().hex
        )
        delete_remote_uptime_subscription(sub.id)
        assert sub.subscription_id is not None
        self.assert_redis_config("default", sub, "delete")
        with pytest.raises(UptimeSubscription.DoesNotExist):
            sub.refresh_from_db()


class UptimeSubscriptionToCheckConfigTest(UptimeTestCase):
    def test_basic(self):
        sub = self.create_uptime_subscription(region_slugs=["default"])

        subscription_id = uuid4().hex
        assert uptime_subscription_to_check_config(sub, subscription_id) == {
            "subscription_id": subscription_id,
            "url": sub.url,
            "interval_seconds": sub.interval_seconds,
            "timeout_ms": sub.timeout_ms,
            "request_method": "GET",
            "request_headers": [],
            "trace_sampling": False,
            "active_regions": ["default"],
            "region_schedule_mode": "round_robin",
        }

    def test_request_fields(self):
        headers = [["hi", "bye"]]
        body = "some request body"
        method = "POST"
        sub = self.create_uptime_subscription(
            method=method,
            headers=headers,
            body=body,
            trace_sampling=True,
            region_slugs=["default"],
        )
        sub.refresh_from_db()

        subscription_id = uuid4().hex
        assert uptime_subscription_to_check_config(sub, subscription_id) == {
            "subscription_id": subscription_id,
            "url": sub.url,
            "interval_seconds": sub.interval_seconds,
            "timeout_ms": sub.timeout_ms,
            "request_method": method,
            "request_headers": headers,
            "request_body": body,
            "trace_sampling": True,
            "active_regions": ["default"],
            "region_schedule_mode": "round_robin",
        }

    def test_header_translation(self):
        headers = {"hi": "bye"}
        sub = self.create_uptime_subscription(headers=headers, region_slugs=["default"])
        sub.refresh_from_db()

        subscription_id = uuid4().hex
        assert uptime_subscription_to_check_config(sub, subscription_id) == {
            "subscription_id": subscription_id,
            "url": sub.url,
            "interval_seconds": sub.interval_seconds,
            "timeout_ms": sub.timeout_ms,
            "request_method": "GET",
            "request_headers": [["hi", "bye"]],
            "trace_sampling": False,
            "active_regions": ["default"],
            "region_schedule_mode": "round_robin",
        }

    def test_no_regions(self):
        sub = self.create_uptime_subscription()
        subscription_id = uuid4().hex
        assert uptime_subscription_to_check_config(sub, subscription_id) == {
            "subscription_id": subscription_id,
            "url": sub.url,
            "interval_seconds": sub.interval_seconds,
            "timeout_ms": sub.timeout_ms,
            "request_method": "GET",
            "request_headers": [],
            "trace_sampling": False,
            "active_regions": [],
            "region_schedule_mode": "round_robin",
        }


class SendUptimeConfigDeletionTest(ConfigPusherTestMixin):
    def test_with_region(self):
        subscription_id = uuid4().hex
        region_slug = "default"
        send_uptime_config_deletion(region_slug, subscription_id)
        self.assert_redis_config(
            region_slug, UptimeSubscription(subscription_id=subscription_id), "delete"
        )


class SubscriptionCheckerTest(UptimeTestCase):
    def test_create_update_delete(self):
        for status in (
            UptimeSubscription.Status.CREATING,
            UptimeSubscription.Status.UPDATING,
            UptimeSubscription.Status.DELETING,
        ):
            sub = self.create_uptime_subscription(
                status=status,
                date_updated=timezone.now() - (SUBSCRIPTION_STATUS_MAX_AGE * 2),
                url=f"http://sentry{status}.io",
            )
            sub_new = self.create_uptime_subscription(
                status=status, date_updated=timezone.now(), url=f"http://santry{status}.io"
            )
            with self.tasks():
                subscription_checker()
            if status == UptimeSubscription.Status.DELETING:
                with pytest.raises(UptimeSubscription.DoesNotExist):
                    sub.refresh_from_db()
                sub_new.refresh_from_db()
                assert sub_new.status == status.value
                assert sub_new.subscription_id is None
            else:
                sub.refresh_from_db()
                assert sub.status == UptimeSubscription.Status.ACTIVE.value
                assert sub.subscription_id is not None
                sub_new.refresh_from_db()
                assert sub_new.status == status.value
                assert sub_new.subscription_id is None


class UpdateUptimeSubscriptionTaskTest(BaseUptimeSubscriptionTaskTest):
    task = update_remote_uptime_subscription
    expected_status = UptimeSubscription.Status.UPDATING

    def test_update(self):
        sub = self.create_uptime_subscription(
            status=UptimeSubscription.Status.UPDATING, region_slugs=["default"]
        )
        update_remote_uptime_subscription(sub.id)

        sub.refresh_from_db()
        assert sub.status == UptimeSubscription.Status.ACTIVE.value

        # Verify config was sent to the region
        self.assert_redis_config("default", sub, "upsert")

    def test_without_regions_uses_default(self):
        sub = self.create_uptime_subscription(
            status=UptimeSubscription.Status.UPDATING,
        )
        get_active_region_configs()[0].slug

        update_remote_uptime_subscription(sub.id)

        sub.refresh_from_db()
        assert sub.status == UptimeSubscription.Status.ACTIVE.value

        # Verify config was sent to default region
        self.assert_redis_config("default", sub, "upsert")
