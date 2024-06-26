from __future__ import annotations

import abc
from unittest.mock import patch
from uuid import uuid4

import pytest

from sentry.testutils.abstract import Abstract
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_kafka
from sentry.uptime.models import UptimeSubscription
from sentry.uptime.subscriptions.tasks import (
    _get_config_codec,
    create_remote_uptime_subscription,
    delete_remote_uptime_subscription,
    send_uptime_config_deletion,
    send_uptime_config_message,
    update_remote_uptime_subscription,
    uptime_subscription_to_check_config,
)
from sentry.utils.hashlib import md5_text

pytestmark = [requires_kafka]


class ProducerTestMixin(TestCase):
    __test__ = Abstract(__module__, __qualname__)

    @pytest.fixture(autouse=True)
    def _setup_producer(self):
        with patch("sentry.uptime.subscriptions.tasks._get_subscription_producer") as producer:
            self.producer = producer.return_value
            yield

    def assert_producer_calls(self, *args: UptimeSubscription | str):
        codec = _get_config_codec()
        expected_payloads = [
            codec.encode(uptime_subscription_to_check_config(arg, str(arg.subscription_id)))
            if isinstance(arg, UptimeSubscription)
            else b""
            for arg in args
        ]
        expected_message_ids = [
            md5_text(arg.subscription_id if isinstance(arg, UptimeSubscription) else arg)
            .hexdigest()
            .encode()
            for arg in args
        ]
        passed_message_ids = [ca[0][1].key for ca in self.producer.produce.call_args_list]
        assert expected_message_ids == passed_message_ids
        passed_payloads = [ca[0][1].value for ca in self.producer.produce.call_args_list]
        assert expected_payloads == passed_payloads


class BaseUptimeSubscriptionTaskTest(ProducerTestMixin, TestCase, metaclass=abc.ABCMeta):
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
        self, status: UptimeSubscription.Status | None = None, subscription_id: str | None = None
    ):
        if status is None:
            status = self.expected_status

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
            )
        )
        self.assert_producer_calls()

    def test_invalid_status(self):
        sub = self.create_subscription(UptimeSubscription.Status.ACTIVE)
        self.task(sub.id)
        self.metrics.incr.assert_called_once_with(
            "uptime.subscriptions.{}.incorrect_status".format(
                self.status_translations[self.expected_status]
            )
        )
        self.assert_producer_calls()


class CreateUptimeSubscriptionTaskTest(BaseUptimeSubscriptionTaskTest):
    expected_status = UptimeSubscription.Status.CREATING
    task = create_remote_uptime_subscription

    def test(self):
        sub = self.create_subscription(UptimeSubscription.Status.CREATING)
        create_remote_uptime_subscription(sub.id)
        sub.refresh_from_db()
        assert sub.status == UptimeSubscription.Status.ACTIVE.value
        assert sub.subscription_id is not None
        self.assert_producer_calls(sub)


class UpdateUptimeSubscriptionTaskTest(BaseUptimeSubscriptionTaskTest):
    expected_status = UptimeSubscription.Status.UPDATING
    task = update_remote_uptime_subscription

    def test(self):
        subscription_id = uuid4().hex
        sub = self.create_subscription(
            UptimeSubscription.Status.UPDATING, subscription_id=subscription_id
        )

        update_remote_uptime_subscription(sub.id)
        sub.refresh_from_db()
        assert sub.status == UptimeSubscription.Status.ACTIVE.value
        assert sub.subscription_id is not None
        assert sub.subscription_id != subscription_id
        self.assert_producer_calls(sub, subscription_id)

    def test_no_subscription_id(self):
        sub = self.create_subscription(UptimeSubscription.Status.UPDATING)
        assert sub.subscription_id is None
        update_remote_uptime_subscription(sub.id)
        sub.refresh_from_db()
        assert sub.status == UptimeSubscription.Status.ACTIVE.value
        assert sub.subscription_id is not None
        self.assert_producer_calls(sub)  # type: ignore[unreachable]


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
        self.assert_producer_calls(subscription_id)

    def test_no_subscription_id(self):
        sub = self.create_subscription(UptimeSubscription.Status.DELETING)
        assert sub.subscription_id is None
        delete_remote_uptime_subscription(sub.id)
        assert not UptimeSubscription.objects.filter(id=sub.id).exists()
        self.assert_producer_calls()


class UptimeSubscriptionToCheckConfigTest(TestCase):
    def test(self):
        sub = self.create_uptime_subscription()
        subscription_id = uuid4().hex
        assert uptime_subscription_to_check_config(sub, subscription_id) == {
            "subscription_id": subscription_id,
            "url": sub.url,
            "interval_seconds": sub.interval_seconds,
            "timeout_ms": sub.timeout_ms,
        }


class SendUptimeConfigDeletionTest(ProducerTestMixin):
    def test(self):
        subscription_id = uuid4().hex
        send_uptime_config_deletion(subscription_id)
        self.assert_producer_calls(subscription_id)


class SendUptimeConfigMessageTest(ProducerTestMixin):
    def test(self):
        subscription_id = uuid4().hex
        sub = self.create_uptime_subscription()
        check_config = uptime_subscription_to_check_config(sub, subscription_id)
        send_uptime_config_message(subscription_id, _get_config_codec().encode(check_config))
        sub.subscription_id = subscription_id
        self.assert_producer_calls(sub)
