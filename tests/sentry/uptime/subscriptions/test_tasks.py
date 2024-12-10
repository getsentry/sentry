from __future__ import annotations

import abc
from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from django.utils import timezone

from sentry.testutils.abstract import Abstract
from sentry.testutils.cases import UptimeTestCase
from sentry.testutils.skips import requires_kafka
from sentry.uptime.config_producer import UPTIME_CONFIGS_CODEC
from sentry.uptime.models import UptimeSubscription
from sentry.uptime.subscriptions.tasks import (
    SUBSCRIPTION_STATUS_MAX_AGE,
    create_remote_uptime_subscription,
    delete_remote_uptime_subscription,
    send_uptime_config_deletion,
    subscription_checker,
    uptime_subscription_to_check_config,
)

pytestmark = [requires_kafka]


class ProducerTestMixin(UptimeTestCase):
    __test__ = Abstract(__module__, __qualname__)

    @pytest.fixture(autouse=True)
    def _setup_producer(self):
        with patch("sentry.uptime.config_producer._configs_producer") as producer:
            self.producer = producer
            yield

    def assert_producer_calls(self, *args: UptimeSubscription | str):
        expected_payloads = [
            (
                UPTIME_CONFIGS_CODEC.encode(
                    uptime_subscription_to_check_config(arg, str(arg.subscription_id))
                )
                if isinstance(arg, UptimeSubscription)
                else None
            )
            for arg in args
        ]
        expected_message_ids = [
            UUID(arg.subscription_id if isinstance(arg, UptimeSubscription) else arg).bytes
            for arg in args
        ]
        passed_message_ids = [ca[0][1].key for ca in self.producer.produce.call_args_list]
        assert expected_message_ids == passed_message_ids
        passed_payloads = [ca[0][1].value for ca in self.producer.produce.call_args_list]
        assert expected_payloads == passed_payloads


class BaseUptimeSubscriptionTaskTest(ProducerTestMixin, metaclass=abc.ABCMeta):
    __test__ = Abstract(__module__, __qualname__)

    status_translations = {
        UptimeSubscription.Status.CREATING: "create",
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
            ),
            sample_rate=1.0,
        )
        self.assert_producer_calls()

    def test_invalid_status(self):
        sub = self.create_subscription(UptimeSubscription.Status.ACTIVE)
        self.task(sub.id)
        self.metrics.incr.assert_called_once_with(
            "uptime.subscriptions.{}.incorrect_status".format(
                self.status_translations[self.expected_status]
            ),
            sample_rate=1.0,
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


class UptimeSubscriptionToCheckConfigTest(UptimeTestCase):
    def test(self):
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
        }

    def test_request_fields(self):
        headers = [["hi", "bye"]]
        body = "some request body"
        method = "POST"
        sub = self.create_uptime_subscription(
            method=method, headers=headers, body=body, trace_sampling=True
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
        }

    def test_header_translation(self):
        headers = {"hi": "bye"}
        sub = self.create_uptime_subscription(headers=headers)
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
        }


class SendUptimeConfigDeletionTest(ProducerTestMixin):
    def test(self):
        subscription_id = uuid4().hex
        send_uptime_config_deletion(subscription_id)
        self.assert_producer_calls(subscription_id)


class SubscriptionCheckerTest(UptimeTestCase):
    def test_create_delete(self):
        for status in (
            UptimeSubscription.Status.CREATING,
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
