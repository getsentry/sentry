import abc
import uuid
from datetime import datetime, timedelta, timezone
from hashlib import md5
from typing import Literal
from unittest import mock
from unittest.mock import call

import pytest
from arroyo import Message
from arroyo.backends.kafka import KafkaPayload
from arroyo.processing.strategies import ProcessingStrategy
from arroyo.types import BrokerValue, Partition, Topic
from django.test import override_settings
from sentry_kafka_schemas.schema_types.uptime_results_v1 import (
    CHECKSTATUS_FAILURE,
    CHECKSTATUS_MISSED_WINDOW,
    CHECKSTATUS_SUCCESS,
    CHECKSTATUSREASONTYPE_TIMEOUT,
    CheckResult,
)

from sentry.conf.types import kafka_definition
from sentry.conf.types.uptime import UptimeRegionConfig
from sentry.constants import ObjectStatus
from sentry.issues.grouptype import UptimeDomainCheckFailure
from sentry.models.group import Group, GroupStatus
from sentry.testutils.abstract import Abstract
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.options import override_options
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
from sentry.utils import json
from tests.sentry.uptime.subscriptions.test_tasks import ConfigPusherTestMixin


class ProcessResultTest(ConfigPusherTestMixin, metaclass=abc.ABCMeta):
    __test__ = Abstract(__module__, __qualname__)

    @property
    @abc.abstractmethod
    def strategy_processing_mode(self) -> Literal["batched-parallel", "parallel", "serial"]:
        pass

    def setUp(self):
        super().setUp()
        self.partition = Partition(Topic("test"), 0)
        self.subscription = self.create_uptime_subscription(
            subscription_id=uuid.uuid4().hex, interval_seconds=300
        )
        self.project_subscription = self.create_project_uptime_subscription(
            uptime_subscription=self.subscription,
            owner=self.user,
        )

    def send_result(
        self, result: CheckResult, consumer: ProcessingStrategy[KafkaPayload] | None = None
    ):
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
            if consumer is None:
                factory = UptimeResultsStrategyFactory(mode=self.strategy_processing_mode)
                commit = mock.Mock()
                consumer = factory.create_with_partitions(commit, {self.partition: 0})

            consumer.submit(message)

    def test(self):
        result = self.create_uptime_result(
            self.subscription.subscription_id,
            scheduled_check_time=datetime.now() - timedelta(minutes=5),
        )
        with (
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
            self.feature(["organizations:uptime", "organizations:uptime-create-issues"]),
            mock.patch(
                "sentry.uptime.consumers.results_consumer.ACTIVE_FAILURE_THRESHOLD",
                new=2,
            ),
        ):
            self.send_result(result)
            metrics.incr.assert_has_calls(
                [
                    call(
                        "uptime.result_processor.handle_result_for_project",
                        tags={
                            "status_reason": CHECKSTATUSREASONTYPE_TIMEOUT,
                            "status": CHECKSTATUS_FAILURE,
                            "mode": "auto_detected_active",
                            "uptime_region": "us-west",
                            "host_provider": "TEST",
                        },
                        sample_rate=1.0,
                    ),
                    call(
                        "uptime.result_processor.active.under_threshold",
                        sample_rate=1.0,
                        tags={
                            "status": CHECKSTATUS_FAILURE,
                            "host_provider": "TEST",
                            "uptime_region": "us-west",
                        },
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
                            "status_reason": CHECKSTATUSREASONTYPE_TIMEOUT,
                            "status": CHECKSTATUS_FAILURE,
                            "mode": "auto_detected_active",
                            "uptime_region": "us-west",
                            "host_provider": "TEST",
                        },
                        sample_rate=1.0,
                    ),
                ]
            )

        hashed_fingerprint = md5(str(self.project_subscription.id).encode("utf-8")).hexdigest()
        group = Group.objects.get(grouphash__hash=hashed_fingerprint)
        assert group.issue_type == UptimeDomainCheckFailure
        assignee = group.get_assignee()
        assert assignee and (assignee.id == self.user.id)
        self.project_subscription.refresh_from_db()
        assert self.project_subscription.uptime_status == UptimeStatus.FAILED

    def test_no_uptime_region_default(self):
        result = self.create_uptime_result(
            self.subscription.subscription_id,
            scheduled_check_time=datetime.now() - timedelta(minutes=5),
            uptime_region=None,
        )
        with (
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
            self.feature(["organizations:uptime", "organizations:uptime-create-issues"]),
            mock.patch(
                "sentry.uptime.consumers.results_consumer.ACTIVE_FAILURE_THRESHOLD",
                new=2,
            ),
        ):
            self.send_result(result)
            metrics.incr.assert_has_calls(
                [
                    call(
                        "uptime.result_processor.handle_result_for_project",
                        tags={
                            "status_reason": CHECKSTATUSREASONTYPE_TIMEOUT,
                            "status": CHECKSTATUS_FAILURE,
                            "mode": "auto_detected_active",
                            "uptime_region": "default",
                            "host_provider": "TEST",
                        },
                        sample_rate=1.0,
                    ),
                    call(
                        "uptime.result_processor.active.under_threshold",
                        sample_rate=1.0,
                        tags={
                            "host_provider": "TEST",
                            "status": CHECKSTATUS_FAILURE,
                            "uptime_region": "default",
                        },
                    ),
                ]
            )

    def test_restricted_host_provider_id(self):
        """
        Test that we do NOT create an issue when the host provider identifier
        has been restricted using the
        `restrict-issue-creation-by-hosting-provider-id` option.
        """
        result = self.create_uptime_result(
            self.subscription.subscription_id,
            scheduled_check_time=datetime.now() - timedelta(minutes=5),
        )
        with (
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
            self.feature(["organizations:uptime", "organizations:uptime-create-issues"]),
            mock.patch(
                "sentry.uptime.consumers.results_consumer.ACTIVE_FAILURE_THRESHOLD",
                new=1,
            ),
            override_options({"uptime.restrict-issue-creation-by-hosting-provider-id": ["TEST"]}),
        ):
            self.send_result(result)
            metrics.incr.assert_has_calls(
                [
                    call(
                        "uptime.result_processor.restricted_by_provider",
                        sample_rate=1.0,
                        tags={
                            "host_provider_id": "TEST",
                            "uptime_region": "us-west",
                            "status": CHECKSTATUS_FAILURE,
                            "host_provider": "TEST",
                        },
                    ),
                ],
                any_order=True,
            )

        # Issue is not created
        hashed_fingerprint = md5(str(self.project_subscription.id).encode("utf-8")).hexdigest()
        with pytest.raises(Group.DoesNotExist):
            Group.objects.get(grouphash__hash=hashed_fingerprint)

        # subscription status is still updated
        self.project_subscription.refresh_from_db()
        assert self.project_subscription.uptime_status == UptimeStatus.FAILED

    def test_reset_fail_count(self):
        with (
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
            self.feature(["organizations:uptime", "organizations:uptime-create-issues"]),
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
                            "status_reason": CHECKSTATUSREASONTYPE_TIMEOUT,
                            "status": CHECKSTATUS_FAILURE,
                            "mode": "auto_detected_active",
                            "uptime_region": "us-west",
                            "host_provider": "TEST",
                        },
                        sample_rate=1.0,
                    ),
                    call(
                        "uptime.result_processor.active.under_threshold",
                        sample_rate=1.0,
                        tags={
                            "uptime_region": "us-west",
                            "status": CHECKSTATUS_FAILURE,
                            "host_provider": "TEST",
                        },
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
                            "status_reason": CHECKSTATUSREASONTYPE_TIMEOUT,
                            "status": CHECKSTATUS_SUCCESS,
                            "mode": "auto_detected_active",
                            "uptime_region": "us-west",
                            "host_provider": "TEST",
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
                            "status_reason": CHECKSTATUSREASONTYPE_TIMEOUT,
                            "status": CHECKSTATUS_FAILURE,
                            "mode": "auto_detected_active",
                            "uptime_region": "us-west",
                            "host_provider": "TEST",
                        },
                        sample_rate=1.0,
                    ),
                    call(
                        "uptime.result_processor.active.under_threshold",
                        sample_rate=1.0,
                        tags={
                            "status": CHECKSTATUS_FAILURE,
                            "host_provider": "TEST",
                            "uptime_region": "us-west",
                        },
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
        with (
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
            mock.patch(
                "sentry.uptime.consumers.results_consumer.ACTIVE_FAILURE_THRESHOLD",
                new=1,
            ),
        ):
            self.send_result(result)
            metrics.incr.assert_has_calls(
                [
                    call(
                        "uptime.result_processor.handle_result_for_project",
                        tags={
                            "status_reason": CHECKSTATUSREASONTYPE_TIMEOUT,
                            "status": CHECKSTATUS_FAILURE,
                            "mode": "auto_detected_active",
                            "uptime_region": "us-west",
                            "host_provider": "TEST",
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
        with (
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
            self.feature(["organizations:uptime", "organizations:uptime-create-issues"]),
            mock.patch(
                "sentry.uptime.consumers.results_consumer.ACTIVE_FAILURE_THRESHOLD",
                new=2,
            ),
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
                            "status_reason": CHECKSTATUSREASONTYPE_TIMEOUT,
                            "status": CHECKSTATUS_FAILURE,
                            "mode": "auto_detected_active",
                            "uptime_region": "us-west",
                            "host_provider": "TEST",
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
                            "status_reason": CHECKSTATUSREASONTYPE_TIMEOUT,
                            "status": CHECKSTATUS_FAILURE,
                            "mode": "auto_detected_active",
                            "uptime_region": "us-west",
                            "host_provider": "TEST",
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
        with (
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
            self.feature("organizations:uptime-create-issues"),
        ):
            self.send_result(result)
            metrics.incr.assert_has_calls(
                [
                    call(
                        "uptime.result_processor.handle_result_for_project",
                        tags={
                            "status_reason": CHECKSTATUSREASONTYPE_TIMEOUT,
                            "status": CHECKSTATUS_SUCCESS,
                            "mode": "auto_detected_active",
                            "uptime_region": "us-west",
                            "host_provider": "TEST",
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
        with (
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
            self.feature(["organizations:uptime", "organizations:uptime-create-issues"]),
        ):
            self.send_result(result)
            metrics.incr.assert_has_calls(
                [
                    call(
                        "uptime.result_processor.subscription_not_found",
                        tags={"uptime_region": "us-west"},
                        sample_rate=1.0,
                    )
                ]
            )
            self.assert_redis_config(
                "default", UptimeSubscription(subscription_id=subscription_id), "delete"
            )

    def test_multiple_project_subscriptions_with_disabled(self):
        """
        Tests that we do not process results for disabled project subscriptions
        """
        # Second disabled project subscription
        self.create_project_uptime_subscription(
            uptime_subscription=self.subscription,
            project=self.create_project(),
            status=ObjectStatus.DISABLED,
        )
        result = self.create_uptime_result(self.subscription.subscription_id)

        with (
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
            self.feature(["organizations:uptime", "organizations:uptime-create-issues"]),
        ):
            self.send_result(result)
            # We only process a single project result, the other is dropped,
            # there should be only one handle_result_for_project metric call
            handle_result_calls = [
                c
                for c in metrics.incr.mock_calls
                if c[1][0] == "uptime.result_processor.handle_result_for_project"
            ]
            assert len(handle_result_calls) == 1

    def test_organization_feature_disabled(self):
        """
        Tests that we do not process results for disabled project subscriptions
        """
        # Second disabled project subscription
        result = self.create_uptime_result(self.subscription.subscription_id)

        with (
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
            self.feature({"organizations:uptime": False}),
        ):
            self.send_result(result)
            handle_result_calls = [
                c
                for c in metrics.incr.mock_calls
                if c[1][0] == "uptime.result_processor.handle_result_for_project"
            ]
            assert len(handle_result_calls) == 0
            metrics.incr.assert_has_calls(
                [
                    call("uptime.result_processor.dropped_no_feature"),
                ]
            )

    def test_skip_already_processed(self):
        result = self.create_uptime_result(self.subscription.subscription_id)
        _get_cluster().set(
            build_last_update_key(self.project_subscription),
            int(result["scheduled_check_time_ms"]),
        )
        with (
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
            self.feature(["organizations:uptime", "organizations:uptime-create-issues"]),
        ):
            self.send_result(result)
            metrics.incr.assert_has_calls(
                [
                    call(
                        "uptime.result_processor.handle_result_for_project",
                        tags={
                            "status_reason": CHECKSTATUSREASONTYPE_TIMEOUT,
                            "status": CHECKSTATUS_FAILURE,
                            "mode": "auto_detected_active",
                            "uptime_region": "us-west",
                            "host_provider": "TEST",
                        },
                        sample_rate=1.0,
                    ),
                    call(
                        "uptime.result_processor.skipping_already_processed_update",
                        tags={
                            "status": CHECKSTATUS_FAILURE,
                            "mode": "auto_detected_active",
                            "uptime_region": "us-west",
                            "host_provider": "TEST",
                        },
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
            self.feature(["organizations:uptime", "organizations:uptime-create-issues"]),
        ):
            self.send_result(result)
            metrics.incr.assert_called_once_with(
                "uptime.result_processor.handle_result_for_project",
                tags={
                    "status": CHECKSTATUS_MISSED_WINDOW,
                    "mode": "auto_detected_active",
                    "status_reason": CHECKSTATUSREASONTYPE_TIMEOUT,
                    "uptime_region": "us-west",
                    "host_provider": "TEST",
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
        with (
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
            self.feature(["organizations:uptime", "organizations:uptime-create-issues"]),
        ):
            self.send_result(result)
            metrics.incr.assert_has_calls(
                [
                    call(
                        "uptime.result_processor.handle_result_for_project",
                        tags={
                            "status": CHECKSTATUS_FAILURE,
                            "mode": "auto_detected_onboarding",
                            "status_reason": CHECKSTATUSREASONTYPE_TIMEOUT,
                            "uptime_region": "us-west",
                            "host_provider": "TEST",
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
            self.feature(["organizations:uptime", "organizations:uptime-create-issues"]),
        ):
            self.send_result(result)
            metrics.incr.assert_has_calls(
                [
                    call(
                        "uptime.result_processor.handle_result_for_project",
                        tags={
                            "status": CHECKSTATUS_FAILURE,
                            "mode": "auto_detected_onboarding",
                            "status_reason": CHECKSTATUSREASONTYPE_TIMEOUT,
                            "uptime_region": "us-west",
                            "host_provider": "TEST",
                        },
                        sample_rate=1.0,
                    ),
                    call(
                        "uptime.result_processor.autodetection.failed_onboarding",
                        tags={
                            "failure_reason": CHECKSTATUSREASONTYPE_TIMEOUT,
                            "uptime_region": "us-west",
                            "host_provider": "TEST",
                            "status": CHECKSTATUS_FAILURE,
                        },
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
        with (
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
            self.feature(["organizations:uptime", "organizations:uptime-create-issues"]),
        ):
            self.send_result(result)
            metrics.incr.assert_has_calls(
                [
                    call(
                        "uptime.result_processor.handle_result_for_project",
                        tags={
                            "status_reason": CHECKSTATUSREASONTYPE_TIMEOUT,
                            "status": CHECKSTATUS_SUCCESS,
                            "mode": "auto_detected_onboarding",
                            "uptime_region": "us-west",
                            "host_provider": "TEST",
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
        with (
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
            self.tasks(),
            self.feature(["organizations:uptime", "organizations:uptime-create-issues"]),
        ):
            self.send_result(result)
            metrics.incr.assert_has_calls(
                [
                    call(
                        "uptime.result_processor.handle_result_for_project",
                        tags={
                            "status_reason": CHECKSTATUSREASONTYPE_TIMEOUT,
                            "status": CHECKSTATUS_SUCCESS,
                            "mode": "auto_detected_onboarding",
                            "uptime_region": "us-west",
                            "host_provider": "TEST",
                        },
                        sample_rate=1.0,
                    ),
                    call(
                        "uptime.result_processor.autodetection.graduated_onboarding",
                        tags={
                            "status": CHECKSTATUS_SUCCESS,
                            "uptime_region": "us-west",
                            "host_provider": "TEST",
                        },
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

    def test_parallel(self) -> None:
        """
        Validates that the consumer in parallel mode correctly groups check-ins
        into groups by their monitor slug / environment
        """

        factory = UptimeResultsStrategyFactory(
            mode="batched-parallel",
            max_batch_size=3,
            max_workers=1,
        )
        consumer = factory.create_with_partitions(mock.Mock(), {self.partition: 0})
        with mock.patch.object(type(factory.result_processor), "__call__") as mock_processor_call:
            subscription_2 = self.create_uptime_subscription(
                subscription_id=uuid.uuid4().hex, interval_seconds=300, url="http://santry.io"
            )

            result_1 = self.create_uptime_result(
                self.subscription.subscription_id,
                scheduled_check_time=datetime.now() - timedelta(minutes=5),
            )

            self.send_result(result_1, consumer=consumer)
            result_2 = self.create_uptime_result(
                self.subscription.subscription_id,
                scheduled_check_time=datetime.now() - timedelta(minutes=4),
            )

            self.send_result(result_2, consumer=consumer)
            # This will fill the batch
            result_3 = self.create_uptime_result(
                subscription_2.subscription_id,
                scheduled_check_time=datetime.now() - timedelta(minutes=4),
            )
            self.send_result(result_3, consumer=consumer)
            # Should be no calls yet, since we didn't send the batch
            assert mock_processor_call.call_count == 0
            # One more causes the previous batch to send
            self.send_result(
                self.create_uptime_result(
                    subscription_2.subscription_id,
                    scheduled_check_time=datetime.now() - timedelta(minutes=3),
                ),
                consumer=consumer,
            )

            assert mock_processor_call.call_count == 3
            mock_processor_call.assert_has_calls([call(result_1), call(result_2), call(result_3)])

    @mock.patch(
        "sentry.remote_subscriptions.consumers.result_consumer.ResultsStrategyFactory.process_group"
    )
    def test_parallel_grouping(self, mock_process_group) -> None:
        """
        Validates that the consumer in parallel mode correctly groups check-ins
        into groups by their monitor slug / environment
        """

        factory = UptimeResultsStrategyFactory(
            mode="batched-parallel",
            max_batch_size=3,
            max_workers=1,
        )
        consumer = factory.create_with_partitions(mock.Mock(), {self.partition: 0})
        subscription_2 = self.create_uptime_subscription(
            subscription_id=uuid.uuid4().hex, interval_seconds=300, url="http://santry.io"
        )

        result_1 = self.create_uptime_result(
            self.subscription.subscription_id,
            scheduled_check_time=datetime.now() - timedelta(minutes=5),
        )

        self.send_result(result_1, consumer=consumer)
        result_2 = self.create_uptime_result(
            self.subscription.subscription_id,
            scheduled_check_time=datetime.now() - timedelta(minutes=4),
        )

        self.send_result(result_2, consumer=consumer)
        # This will fill the batch
        result_3 = self.create_uptime_result(
            subscription_2.subscription_id,
            scheduled_check_time=datetime.now() - timedelta(minutes=4),
        )
        self.send_result(result_3, consumer=consumer)
        # Should be no calls yet, since we didn't send the batch
        assert mock_process_group.call_count == 0
        # One more causes the previous batch to send
        self.send_result(result_3, consumer=consumer)
        assert mock_process_group.call_count == 2
        group_1 = mock_process_group.mock_calls[0].args[0]
        group_2 = mock_process_group.mock_calls[1].args[0]
        assert group_1 == [result_1, result_2]
        assert group_2 == [result_3]

    def test_provider_stats(self):
        subscription = self.create_uptime_subscription(
            subscription_id=uuid.uuid4().hex,
            host_provider_name="test_provider",
        )
        self.create_project_uptime_subscription(self.project, uptime_subscription=subscription)
        self.create_uptime_subscription(
            subscription_id=uuid.uuid4().hex,
            host_provider_name="test_provider",
        )
        result = self.create_uptime_result(
            subscription.subscription_id,
            scheduled_check_time=datetime.now() - timedelta(minutes=5),
        )
        result_2 = self.create_uptime_result(
            self.subscription.subscription_id,
            scheduled_check_time=datetime.now() - timedelta(minutes=4),
        )

        with (
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
            self.feature(["organizations:uptime", "organizations:uptime-create-issues"]),
            mock.patch(
                "sentry.uptime.consumers.results_consumer.ACTIVE_FAILURE_THRESHOLD",
                new=2,
            ),
            mock.patch(
                "sentry.uptime.consumers.results_consumer.PROVIDER_NAMES_TO_INCLUDE_AS_TAGS",
                new=1,
            ),
        ):
            self.send_result(result)
            self.send_result(result_2)

            metrics.incr.assert_has_calls(
                [
                    call(
                        "uptime.result_processor.handle_result_for_project",
                        tags={
                            "status_reason": CHECKSTATUSREASONTYPE_TIMEOUT,
                            "status": CHECKSTATUS_FAILURE,
                            "mode": "auto_detected_active",
                            "uptime_region": "us-west",
                            "host_provider": "test_provider",
                        },
                        sample_rate=1.0,
                    ),
                    call(
                        "uptime.result_processor.active.under_threshold",
                        sample_rate=1.0,
                        tags={
                            "status": CHECKSTATUS_FAILURE,
                            "host_provider": "test_provider",
                            "uptime_region": "us-west",
                        },
                    ),
                    call(
                        "uptime.result_processor.handle_result_for_project",
                        tags={
                            "status_reason": CHECKSTATUSREASONTYPE_TIMEOUT,
                            "status": CHECKSTATUS_FAILURE,
                            "mode": "auto_detected_active",
                            "uptime_region": "us-west",
                            "host_provider": "other",
                        },
                        sample_rate=1.0,
                    ),
                    call(
                        "uptime.result_processor.active.under_threshold",
                        sample_rate=1.0,
                        tags={
                            "status": CHECKSTATUS_FAILURE,
                            "host_provider": "other",
                            "uptime_region": "us-west",
                        },
                    ),
                ]
            )

    @mock.patch("sentry.uptime.consumers.results_consumer._snuba_uptime_checks_producer.produce")
    @override_options({"uptime.snuba_uptime_results.enabled": True})
    def test_produces_snuba_uptime_results(self, mock_produce) -> None:
        """
        Validates that the consumer produces a message to Snuba's Kafka topic for uptime check results
        """
        result = self.create_uptime_result(
            self.subscription.subscription_id,
            scheduled_check_time=datetime.now() - timedelta(minutes=5),
        )
        self.send_result(result)
        mock_produce.assert_called_once()

        assert mock_produce.call_args.args[0].name == "snuba-uptime-results"

        parsed_value = json.loads(mock_produce.call_args.args[1].value)
        assert parsed_value["organization_id"] == self.project.organization_id
        assert parsed_value["project_id"] == self.project.id
        assert parsed_value["retention_days"] == 90

    def run_check_and_update_region_test(
        self,
        sub: UptimeSubscription,
        regions: list[str],
        disabled_regions: list[str],
        expected_regions_before: set[str],
        expected_regions_after: set[str],
        expected_config_updates: list[tuple[str, str | None]],
        current_minute=5,
    ):
        region_configs = [
            UptimeRegionConfig(slug=slug, name=slug, config_redis_key_prefix=slug)
            for slug in regions
        ]

        with (
            override_settings(UPTIME_REGIONS=region_configs),
            override_options({"uptime.disabled-checker-regions": disabled_regions}),
            self.tasks(),
            freeze_time((datetime.now() - timedelta(hours=1)).replace(minute=current_minute)),
        ):
            result = self.create_uptime_result(
                sub.subscription_id,
                scheduled_check_time=datetime.now(),
            )
            assert {r.region_slug for r in sub.regions.all()} == expected_regions_before
            self.send_result(result)
            sub.refresh_from_db()
            assert {r.region_slug for r in sub.regions.all()} == expected_regions_after
            for expected_region, expected_action in expected_config_updates:
                self.assert_redis_config(expected_region, sub, expected_action)
            assert sub.status == UptimeSubscription.Status.ACTIVE.value

    def test_check_and_update_regions(self):
        sub = self.create_uptime_subscription(
            subscription_id=uuid.UUID(int=5).hex,
            region_slugs=["region1"],
        )
        self.run_check_and_update_region_test(
            sub,
            ["region1", "region2"],
            [],
            {"region1"},
            {"region1"},
            [],
            4,
        )
        self.run_check_and_update_region_test(
            sub,
            ["region1", "region2"],
            [],
            {"region1"},
            {"region1", "region2"},
            [("region1", "upsert"), ("region2", "upsert")],
            5,
        )

    def test_check_and_update_regions_larger_interval(self):
        # Create subscription with only one region
        hour_sub = self.create_uptime_subscription(
            subscription_id=uuid.UUID(int=4).hex,
            region_slugs=["region1"],
            interval_seconds=UptimeSubscription.IntervalSeconds.ONE_HOUR,
        )
        self.run_check_and_update_region_test(
            hour_sub,
            ["region1", "region2"],
            [],
            {"region1"},
            {"region1", "region2"},
            [("region1", "upsert"), ("region2", "upsert")],
            37,
        )

        five_min_sub = self.create_uptime_subscription(
            subscription_id=uuid.UUID(int=6).hex,
            region_slugs=["region1"],
            interval_seconds=UptimeSubscription.IntervalSeconds.FIVE_MINUTES,
        )
        self.run_check_and_update_region_test(
            five_min_sub,
            ["region1", "region2"],
            [],
            {"region1"},
            {"region1"},
            [],
            current_minute=6,
        )
        self.run_check_and_update_region_test(
            five_min_sub,
            ["region1", "region2"],
            [],
            {"region1"},
            {"region1"},
            [],
            current_minute=35,
        )
        self.run_check_and_update_region_test(
            five_min_sub,
            ["region1", "region2"],
            [],
            {"region1"},
            {"region1"},
            [],
            current_minute=49,
        )
        self.run_check_and_update_region_test(
            five_min_sub,
            ["region1", "region2"],
            [],
            {"region1"},
            {"region1", "region2"},
            [("region1", "upsert"), ("region2", "upsert")],
            current_minute=30,
        )
        # Make sure it works any time within the valid window
        five_min_sub = self.create_uptime_subscription(
            subscription_id=uuid.UUID(int=66).hex,
            region_slugs=["region1"],
            interval_seconds=UptimeSubscription.IntervalSeconds.FIVE_MINUTES,
        )
        self.run_check_and_update_region_test(
            five_min_sub,
            ["region1", "region2"],
            [],
            {"region1"},
            {"region1", "region2"},
            [("region1", "upsert"), ("region2", "upsert")],
            current_minute=34,
        )

    def test_check_and_update_regions_removes_disabled(self):
        sub = self.create_uptime_subscription(
            subscription_id=uuid.UUID(int=5).hex, region_slugs=["region1", "region2"]
        )
        self.run_check_and_update_region_test(
            sub,
            ["region1", "region2"],
            ["region2"],
            {"region1", "region2"},
            {"region1", "region2"},
            [],
            current_minute=4,
        )
        self.run_check_and_update_region_test(
            sub,
            ["region1", "region2"],
            ["region2"],
            {"region1", "region2"},
            {"region1"},
            [("region1", "upsert"), ("region2", "delete")],
            current_minute=5,
        )


class ProcessResultSerialTest(ProcessResultTest):
    strategy_processing_mode = "serial"

    def test_parallel(self) -> None:
        """
        Validates that the consumer in parallel mode correctly groups check-ins
        into groups by their monitor slug / environment
        """

        factory = UptimeResultsStrategyFactory(
            mode="batched-parallel",
            max_batch_size=3,
            max_workers=1,
        )
        consumer = factory.create_with_partitions(mock.Mock(), {self.partition: 0})
        with mock.patch.object(type(factory.result_processor), "__call__") as mock_processor_call:
            subscription_2 = self.create_uptime_subscription(
                subscription_id=uuid.uuid4().hex, interval_seconds=300, url="http://santry.io"
            )

            result_1 = self.create_uptime_result(
                self.subscription.subscription_id,
                scheduled_check_time=datetime.now() - timedelta(minutes=5),
            )

            self.send_result(result_1, consumer=consumer)
            result_2 = self.create_uptime_result(
                self.subscription.subscription_id,
                scheduled_check_time=datetime.now() - timedelta(minutes=4),
            )

            self.send_result(result_2, consumer=consumer)
            # This will fill the batch
            result_3 = self.create_uptime_result(
                subscription_2.subscription_id,
                scheduled_check_time=datetime.now() - timedelta(minutes=4),
            )
            self.send_result(result_3, consumer=consumer)
            # Should be no calls yet, since we didn't send the batch
            assert mock_processor_call.call_count == 0
            # One more causes the previous batch to send
            self.send_result(
                self.create_uptime_result(
                    subscription_2.subscription_id,
                    scheduled_check_time=datetime.now() - timedelta(minutes=3),
                ),
                consumer=consumer,
            )

            assert mock_processor_call.call_count == 3
            mock_processor_call.assert_has_calls([call(result_1), call(result_2), call(result_3)])

    @mock.patch(
        "sentry.remote_subscriptions.consumers.result_consumer.ResultsStrategyFactory.process_group"
    )
    def test_parallel_grouping(self, mock_process_group) -> None:
        """
        Validates that the consumer in parallel mode correctly groups check-ins
        into groups by their monitor slug / environment
        """

        factory = UptimeResultsStrategyFactory(
            mode="batched-parallel",
            max_batch_size=3,
            max_workers=1,
        )
        consumer = factory.create_with_partitions(mock.Mock(), {self.partition: 0})
        subscription_2 = self.create_uptime_subscription(
            subscription_id=uuid.uuid4().hex, interval_seconds=300, url="http://santry.io"
        )

        result_1 = self.create_uptime_result(
            self.subscription.subscription_id,
            scheduled_check_time=datetime.now() - timedelta(minutes=5),
        )

        self.send_result(result_1, consumer=consumer)
        result_2 = self.create_uptime_result(
            self.subscription.subscription_id,
            scheduled_check_time=datetime.now() - timedelta(minutes=4),
        )

        self.send_result(result_2, consumer=consumer)
        # This will fill the batch
        result_3 = self.create_uptime_result(
            subscription_2.subscription_id,
            scheduled_check_time=datetime.now() - timedelta(minutes=4),
        )
        self.send_result(result_3, consumer=consumer)
        # Should be no calls yet, since we didn't send the batch
        assert mock_process_group.call_count == 0
        # One more causes the previous batch to send
        self.send_result(result_3, consumer=consumer)
        assert mock_process_group.call_count == 2
        group_1 = mock_process_group.mock_calls[0].args[0]
        group_2 = mock_process_group.mock_calls[1].args[0]
        assert group_1 == [result_1, result_2]
        assert group_2 == [result_3]


class ProcessResultParallelTest(ProcessResultTest):
    strategy_processing_mode = "parallel"
