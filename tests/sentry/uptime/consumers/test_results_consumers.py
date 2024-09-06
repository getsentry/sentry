import uuid
from datetime import datetime, timedelta, timezone
from hashlib import md5
from unittest import mock
from unittest.mock import call

import pytest
from arroyo import Message
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Partition, Topic
from sentry_kafka_schemas.schema_types.uptime_results_v1 import (
    CHECKSTATUS_FAILURE,
    CHECKSTATUS_MISSED_WINDOW,
    CHECKSTATUS_SUCCESS,
    CHECKSTATUSREASONTYPE_TIMEOUT,
    CheckResult,
)

from sentry.conf.types import kafka_definition
from sentry.issues.grouptype import UptimeDomainCheckFailure
from sentry.models.group import Group, GroupStatus
from sentry.testutils.cases import UptimeTestCase
from sentry.uptime.consumers.results_consumer import (
    AUTO_DETECTED_ACTIVE_SUBSCRIPTION_INTERVAL,
    ONBOARDING_MONITOR_PERIOD,
    UptimeResultsStrategyFactory,
    build_last_update_key,
    build_onboarding_failure_key,
)
from sentry.uptime.detectors.ranking import _get_cluster
from sentry.uptime.detectors.tasks import is_failed_url
from sentry.uptime.models import (
    ProjectUptimeSubscription,
    ProjectUptimeSubscriptionMode,
    UptimeStatus,
    UptimeSubscription,
)
from tests.sentry.uptime.subscriptions.test_tasks import ProducerTestMixin


class ProcessResultTest(UptimeTestCase, ProducerTestMixin):
    def setUp(self):
        super().setUp()
        self.partition = Partition(Topic("test"), 0)
        self.subscription = self.create_uptime_subscription(
            subscription_id=uuid.uuid4().hex, interval_seconds=300
        )
        self.project_subscription = self.create_project_uptime_subscription(
            uptime_subscription=self.subscription
        )

    def send_result(self, result: CheckResult):
        codec = kafka_definition.get_topic_codec(kafka_definition.Topic.UPTIME_RESULTS)
        message = Message(
            BrokerValue(
                KafkaPayload(None, codec.encode(result), []),
                Partition(Topic("test"), 1),
                1,
                datetime.now(),
            )
        )
        with self.feature(UptimeDomainCheckFailure.build_ingest_feature_name()):
            factory = UptimeResultsStrategyFactory()
            commit = mock.Mock()

            consumer = factory.create_with_partitions(commit, {self.partition: 0})
            consumer.submit(message)

    def test(self):
        result = self.create_uptime_result(
            self.subscription.subscription_id,
            scheduled_check_time=datetime.now() - timedelta(minutes=5),
        )
        with mock.patch(
            "sentry.uptime.consumers.results_consumer.metrics"
        ) as metrics, self.feature("organizations:uptime-create-issues"), mock.patch(
            "sentry.uptime.consumers.results_consumer.ACTIVE_FAILURE_THRESHOLD",
            new=2,
        ):
            self.send_result(result)
            metrics.incr.assert_has_calls(
                [
                    call(
                        "uptime.result_processor.handle_result_for_project",
                        tags={
                            "status_reason": "timeout",
                            "status": "failure",
                            "mode": "auto_detected_active",
                        },
                        sample_rate=1.0,
                    ),
                    call(
                        "uptime.result_processor.active.under_threshold",
                        sample_rate=1.0,
                        tags={"status": "failure"},
                    ),
                ]
            )
            metrics.incr.reset_mock()
            self.send_result(
                self.create_uptime_result(
                    self.subscription.subscription_id,
                    scheduled_check_time=datetime.now() - timedelta(minutes=4),
                )
            )
            metrics.incr.assert_has_calls(
                [
                    call(
                        "uptime.result_processor.handle_result_for_project",
                        tags={
                            "status_reason": "timeout",
                            "status": "failure",
                            "mode": "auto_detected_active",
                        },
                        sample_rate=1.0,
                    ),
                ]
            )

        hashed_fingerprint = md5(str(self.project_subscription.id).encode("utf-8")).hexdigest()
        group = Group.objects.get(grouphash__hash=hashed_fingerprint)
        assert group.issue_type == UptimeDomainCheckFailure
        self.project_subscription.refresh_from_db()
        assert self.project_subscription.uptime_status == UptimeStatus.FAILED

    def test_reset_fail_count(self):
        with mock.patch(
            "sentry.uptime.consumers.results_consumer.metrics"
        ) as metrics, self.feature("organizations:uptime-create-issues"):
            self.send_result(
                self.create_uptime_result(
                    self.subscription.subscription_id,
                    scheduled_check_time=datetime.now() - timedelta(minutes=5),
                )
            )
            metrics.incr.assert_has_calls(
                [
                    call(
                        "uptime.result_processor.handle_result_for_project",
                        tags={
                            "status_reason": "timeout",
                            "status": "failure",
                            "mode": "auto_detected_active",
                        },
                        sample_rate=1.0,
                    ),
                    call(
                        "uptime.result_processor.active.under_threshold",
                        sample_rate=1.0,
                        tags={"status": "failure"},
                    ),
                ]
            )
            metrics.incr.reset_mock()
            self.send_result(
                self.create_uptime_result(
                    self.subscription.subscription_id,
                    status=CHECKSTATUS_SUCCESS,
                    scheduled_check_time=datetime.now() - timedelta(minutes=4),
                )
            )
            metrics.incr.assert_has_calls(
                [
                    call(
                        "uptime.result_processor.handle_result_for_project",
                        tags={
                            "status_reason": "timeout",
                            "status": "success",
                            "mode": "auto_detected_active",
                        },
                        sample_rate=1.0,
                    ),
                ]
            )
            metrics.incr.reset_mock()
            self.send_result(
                self.create_uptime_result(
                    self.subscription.subscription_id,
                    scheduled_check_time=datetime.now() - timedelta(minutes=3),
                )
            )
            metrics.incr.assert_has_calls(
                [
                    call(
                        "uptime.result_processor.handle_result_for_project",
                        tags={
                            "status_reason": "timeout",
                            "status": "failure",
                            "mode": "auto_detected_active",
                        },
                        sample_rate=1.0,
                    ),
                    call(
                        "uptime.result_processor.active.under_threshold",
                        sample_rate=1.0,
                        tags={"status": "failure"},
                    ),
                ]
            )

        hashed_fingerprint = md5(str(self.project_subscription.id).encode("utf-8")).hexdigest()
        with pytest.raises(Group.DoesNotExist):
            Group.objects.get(grouphash__hash=hashed_fingerprint)
        self.project_subscription.refresh_from_db()
        assert self.project_subscription.uptime_status == UptimeStatus.OK

    def test_no_create_issues_feature(self):
        result = self.create_uptime_result(self.subscription.subscription_id)
        with mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics, mock.patch(
            "sentry.uptime.consumers.results_consumer.ACTIVE_FAILURE_THRESHOLD",
            new=1,
        ):
            self.send_result(result)
            metrics.incr.assert_has_calls(
                [
                    call(
                        "uptime.result_processor.handle_result_for_project",
                        tags={
                            "status_reason": "timeout",
                            "status": "failure",
                            "mode": "auto_detected_active",
                        },
                        sample_rate=1.0,
                    )
                ]
            )

        hashed_fingerprint = md5(str(self.project_subscription.id).encode("utf-8")).hexdigest()
        with pytest.raises(Group.DoesNotExist):
            Group.objects.get(grouphash__hash=hashed_fingerprint)
        self.project_subscription.refresh_from_db()
        assert self.project_subscription.uptime_status == UptimeStatus.FAILED

    def test_resolve(self):
        with mock.patch(
            "sentry.uptime.consumers.results_consumer.metrics"
        ) as metrics, self.feature("organizations:uptime-create-issues"), mock.patch(
            "sentry.uptime.consumers.results_consumer.ACTIVE_FAILURE_THRESHOLD",
            new=2,
        ):
            self.send_result(
                self.create_uptime_result(
                    self.subscription.subscription_id,
                    scheduled_check_time=datetime.now() - timedelta(minutes=5),
                )
            )
            metrics.incr.assert_has_calls(
                [
                    call(
                        "uptime.result_processor.handle_result_for_project",
                        tags={
                            "status_reason": "timeout",
                            "status": "failure",
                            "mode": "auto_detected_active",
                        },
                        sample_rate=1.0,
                    ),
                ]
            )
            metrics.incr.reset_mock()
            self.send_result(
                self.create_uptime_result(
                    self.subscription.subscription_id,
                    scheduled_check_time=datetime.now() - timedelta(minutes=4),
                )
            )
            metrics.incr.assert_has_calls(
                [
                    call(
                        "uptime.result_processor.handle_result_for_project",
                        tags={
                            "status_reason": "timeout",
                            "status": "failure",
                            "mode": "auto_detected_active",
                        },
                        sample_rate=1.0,
                    ),
                ]
            )

        hashed_fingerprint = md5(str(self.project_subscription.id).encode("utf-8")).hexdigest()
        group = Group.objects.get(grouphash__hash=hashed_fingerprint)
        assert group.issue_type == UptimeDomainCheckFailure
        assert group.status == GroupStatus.UNRESOLVED
        self.project_subscription.refresh_from_db()
        assert self.project_subscription.uptime_status == UptimeStatus.FAILED

        result = self.create_uptime_result(
            self.subscription.subscription_id,
            status=CHECKSTATUS_SUCCESS,
            scheduled_check_time=datetime.now() - timedelta(minutes=3),
        )
        with mock.patch(
            "sentry.uptime.consumers.results_consumer.metrics"
        ) as metrics, self.feature("organizations:uptime-create-issues"):
            self.send_result(result)
            metrics.incr.assert_has_calls(
                [
                    call(
                        "uptime.result_processor.handle_result_for_project",
                        tags={
                            "status_reason": "timeout",
                            "status": "success",
                            "mode": "auto_detected_active",
                        },
                        sample_rate=1.0,
                    )
                ]
            )
        group.refresh_from_db()
        assert group.status == GroupStatus.RESOLVED
        self.project_subscription.refresh_from_db()
        assert self.project_subscription.uptime_status == UptimeStatus.OK

    def test_no_subscription(self):
        subscription_id = uuid.uuid4().hex
        result = self.create_uptime_result(subscription_id)
        with mock.patch(
            "sentry.uptime.consumers.results_consumer.metrics"
        ) as metrics, self.feature("organizations:uptime-create-issues"):
            self.send_result(result)
            metrics.incr.assert_has_calls(
                [call("uptime.result_processor.subscription_not_found", sample_rate=1.0)]
            )
            self.assert_producer_calls(subscription_id)

    def test_skip_already_processed(self):
        result = self.create_uptime_result(self.subscription.subscription_id)
        _get_cluster().set(
            build_last_update_key(self.project_subscription),
            int(result["scheduled_check_time_ms"]),
        )
        with mock.patch(
            "sentry.uptime.consumers.results_consumer.metrics"
        ) as metrics, self.feature("organizations:uptime-create-issues"):
            self.send_result(result)
            metrics.incr.assert_has_calls(
                [
                    call(
                        "uptime.result_processor.handle_result_for_project",
                        tags={
                            "status_reason": "timeout",
                            "status": "failure",
                            "mode": "auto_detected_active",
                        },
                        sample_rate=1.0,
                    ),
                    call(
                        "uptime.result_processor.skipping_already_processed_update",
                        tags={"status": CHECKSTATUS_FAILURE, "mode": "auto_detected_active"},
                        sample_rate=1.0,
                    ),
                ]
            )

        hashed_fingerprint = md5(str(self.project_subscription.id).encode("utf-8")).hexdigest()
        with pytest.raises(Group.DoesNotExist):
            Group.objects.get(grouphash__hash=hashed_fingerprint)

    def test_missed(self):
        result = self.create_uptime_result(
            self.subscription.subscription_id, status=CHECKSTATUS_MISSED_WINDOW
        )
        with (
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
            mock.patch("sentry.uptime.consumers.results_consumer.logger") as logger,
            self.feature("organizations:uptime-create-issues"),
        ):
            self.send_result(result)
            metrics.incr.assert_called_once_with(
                "uptime.result_processor.handle_result_for_project",
                tags={
                    "status": CHECKSTATUS_MISSED_WINDOW,
                    "mode": "auto_detected_active",
                    "status_reason": "timeout",
                },
                sample_rate=1.0,
            )
            logger.info.assert_any_call(
                "handle_result_for_project.missed",
                extra={"project_id": self.project.id, **result},
            )
        hashed_fingerprint = md5(str(self.project_subscription.id).encode("utf-8")).hexdigest()
        with pytest.raises(Group.DoesNotExist):
            Group.objects.get(grouphash__hash=hashed_fingerprint)

    def test_onboarding_failure(self):
        self.project_subscription.update(
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ONBOARDING
        )
        result = self.create_uptime_result(
            self.subscription.subscription_id,
            status=CHECKSTATUS_FAILURE,
            scheduled_check_time=datetime.now() - timedelta(minutes=5),
        )
        redis = _get_cluster()
        key = build_onboarding_failure_key(self.project_subscription)
        assert redis.get(key) is None
        with mock.patch(
            "sentry.uptime.consumers.results_consumer.metrics"
        ) as metrics, self.feature("organizations:uptime-create-issues"):
            self.send_result(result)
            metrics.incr.assert_has_calls(
                [
                    call(
                        "uptime.result_processor.handle_result_for_project",
                        tags={
                            "status": CHECKSTATUS_FAILURE,
                            "mode": "auto_detected_onboarding",
                            "status_reason": "timeout",
                        },
                        sample_rate=1.0,
                    ),
                ]
            )
        assert redis.get(key) == "1"

        hashed_fingerprint = md5(str(self.project_subscription.id).encode("utf-8")).hexdigest()
        with pytest.raises(Group.DoesNotExist):
            Group.objects.get(grouphash__hash=hashed_fingerprint)

        result = self.create_uptime_result(
            self.subscription.subscription_id,
            status=CHECKSTATUS_FAILURE,
            scheduled_check_time=datetime.now() - timedelta(minutes=4),
        )
        with (
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
            mock.patch(
                "sentry.uptime.consumers.results_consumer.ONBOARDING_FAILURE_THRESHOLD", new=2
            ),
            self.tasks(),
            self.feature("organizations:uptime-create-issues"),
        ):
            self.send_result(result)
            metrics.incr.assert_has_calls(
                [
                    call(
                        "uptime.result_processor.handle_result_for_project",
                        tags={
                            "status": CHECKSTATUS_FAILURE,
                            "mode": "auto_detected_onboarding",
                            "status_reason": "timeout",
                        },
                        sample_rate=1.0,
                    ),
                    call(
                        "uptime.result_processor.autodetection.failed_onboarding",
                        tags={"failure_reason": CHECKSTATUSREASONTYPE_TIMEOUT},
                        sample_rate=1.0,
                    ),
                ]
            )
        assert not redis.exists(key)
        assert is_failed_url(self.subscription.url)

        hashed_fingerprint = md5(str(self.project_subscription.id).encode("utf-8")).hexdigest()
        with pytest.raises(Group.DoesNotExist):
            Group.objects.get(grouphash__hash=hashed_fingerprint)
        with pytest.raises(UptimeSubscription.DoesNotExist):
            self.subscription.refresh_from_db()
        with pytest.raises(ProjectUptimeSubscription.DoesNotExist):
            self.project_subscription.refresh_from_db()

    def test_onboarding_success_ongoing(self):
        self.project_subscription.update(
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ONBOARDING,
            date_added=datetime.now(timezone.utc) - timedelta(minutes=5),
        )
        result = self.create_uptime_result(
            self.subscription.subscription_id,
            status=CHECKSTATUS_SUCCESS,
            scheduled_check_time=datetime.now() - timedelta(minutes=5),
        )
        redis = _get_cluster()
        key = build_onboarding_failure_key(self.project_subscription)
        assert redis.get(key) is None
        with mock.patch(
            "sentry.uptime.consumers.results_consumer.metrics"
        ) as metrics, self.feature("organizations:uptime-create-issues"):
            self.send_result(result)
            metrics.incr.assert_has_calls(
                [
                    call(
                        "uptime.result_processor.handle_result_for_project",
                        tags={
                            "status_reason": "timeout",
                            "status": "success",
                            "mode": "auto_detected_onboarding",
                        },
                        sample_rate=1.0,
                    ),
                ]
            )
        assert not redis.exists(key)

        hashed_fingerprint = md5(str(self.project_subscription.id).encode("utf-8")).hexdigest()
        with pytest.raises(Group.DoesNotExist):
            Group.objects.get(grouphash__hash=hashed_fingerprint)

    def test_onboarding_success_graduate(self):
        self.project_subscription.update(
            mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ONBOARDING,
            date_added=datetime.now(timezone.utc)
            - (ONBOARDING_MONITOR_PERIOD + timedelta(minutes=5)),
        )
        uptime_subscription = self.project_subscription.uptime_subscription
        result = self.create_uptime_result(
            self.subscription.subscription_id,
            status=CHECKSTATUS_SUCCESS,
            scheduled_check_time=datetime.now() - timedelta(minutes=2),
        )
        redis = _get_cluster()
        key = build_onboarding_failure_key(self.project_subscription)
        assert redis.get(key) is None
        with mock.patch(
            "sentry.uptime.consumers.results_consumer.metrics"
        ) as metrics, self.tasks(), self.feature("organizations:uptime-create-issues"):
            self.send_result(result)
            metrics.incr.assert_has_calls(
                [
                    call(
                        "uptime.result_processor.handle_result_for_project",
                        tags={
                            "status_reason": "timeout",
                            "status": "success",
                            "mode": "auto_detected_onboarding",
                        },
                        sample_rate=1.0,
                    ),
                    call(
                        "uptime.result_processor.autodetection.graduated_onboarding",
                        sample_rate=1.0,
                    ),
                ]
            )
        assert not redis.exists(key)

        hashed_fingerprint = md5(str(self.project_subscription.id).encode("utf-8")).hexdigest()
        with pytest.raises(Group.DoesNotExist):
            Group.objects.get(grouphash__hash=hashed_fingerprint)

        self.project_subscription.refresh_from_db()
        assert self.project_subscription.mode == ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE
        with pytest.raises(UptimeSubscription.DoesNotExist):
            uptime_subscription.refresh_from_db()
        new_uptime_subscription = self.project_subscription.uptime_subscription
        assert new_uptime_subscription.interval_seconds == int(
            AUTO_DETECTED_ACTIVE_SUBSCRIPTION_INTERVAL.total_seconds()
        )
        assert uptime_subscription.url == new_uptime_subscription.url
