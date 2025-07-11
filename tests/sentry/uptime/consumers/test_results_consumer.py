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
from sentry.conf.types.kafka_definition import Topic as KafkaTopic
from sentry.conf.types.kafka_definition import get_topic_codec
from sentry.conf.types.uptime import UptimeRegionConfig
from sentry.constants import DataCategory
from sentry.models.group import Group, GroupStatus
from sentry.testutils import thread_leaks
from sentry.testutils.abstract import Abstract
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.options import override_options
from sentry.uptime.consumers.eap_converter import convert_uptime_result_to_trace_items
from sentry.uptime.consumers.results_consumer import (
    UptimeResultsStrategyFactory,
    build_last_seen_interval_key,
    build_last_update_key,
)
from sentry.uptime.detectors.ranking import _get_cluster
from sentry.uptime.detectors.result_handler import (
    AUTO_DETECTED_ACTIVE_SUBSCRIPTION_INTERVAL,
    ONBOARDING_MONITOR_PERIOD,
    build_onboarding_failure_key,
)
from sentry.uptime.detectors.tasks import is_failed_url
from sentry.uptime.grouptype import UptimeDomainCheckFailure, build_detector_fingerprint_component
from sentry.uptime.models import (
    ProjectUptimeSubscription,
    UptimeStatus,
    UptimeSubscription,
    UptimeSubscriptionRegion,
    get_detector,
)
from sentry.uptime.types import IncidentStatus, UptimeMonitorMode
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
            subscription_id=uuid.uuid4().hex, interval_seconds=300, region_slugs=["default"]
        )
        self.project_subscription = self.create_project_uptime_subscription(
            uptime_subscription=self.subscription,
            owner=self.user,
        )
        detector = get_detector(self.subscription)
        assert detector
        self.detector = detector

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
        features = [
            "organizations:uptime",
            "organizations:uptime-create-issues",
            "organizations:uptime-detector-handler",
        ]
        result = self.create_uptime_result(
            self.subscription.subscription_id,
            scheduled_check_time=datetime.now() - timedelta(minutes=5),
        )
        with (
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
            self.feature(features),
            mock.patch(
                "sentry.uptime.consumers.results_consumer.get_active_failure_threshold",
                return_value=2,
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

        fingerprint = build_detector_fingerprint_component(self.detector).encode("utf-8")
        hashed_fingerprint = md5(fingerprint).hexdigest()
        group = Group.objects.get(grouphash__hash=hashed_fingerprint)
        assert group.issue_type == UptimeDomainCheckFailure
        assignee = group.get_assignee()
        assert assignee and (assignee.id == self.user.id)
        self.project_subscription.refresh_from_db()
        assert self.project_subscription.uptime_subscription.uptime_status == UptimeStatus.FAILED

    def test_detector_handler(self):
        """
        Simple test that the detector handler works as expected end-to-end.
        """
        features = [
            "organizations:uptime",
            "organizations:uptime-create-issues",
            "organizations:uptime-detector-handler",
            "organizations:uptime-detector-create-issues",
        ]

        fingerprint = build_detector_fingerprint_component(self.detector).encode("utf-8")
        hashed_fingerprint = md5(fingerprint).hexdigest()

        with (
            self.feature(features),
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
            mock.patch("sentry.uptime.grouptype.get_active_failure_threshold", return_value=2),
            # Only needed to make sure we don't inadvertently also create an
            # issue using the legacy issue creation.
            mock.patch(
                "sentry.uptime.consumers.results_consumer.get_active_failure_threshold",
                return_value=2,
            ),
        ):
            self.send_result(
                self.create_uptime_result(
                    self.subscription.subscription_id,
                    scheduled_check_time=datetime.now() - timedelta(minutes=5),
                )
            )
            assert not Group.objects.filter(grouphash__hash=hashed_fingerprint).exists()
            self.send_result(
                self.create_uptime_result(
                    self.subscription.subscription_id,
                    scheduled_check_time=datetime.now() - timedelta(minutes=4),
                )
            )
            # Issue is created
            assert Group.objects.filter(grouphash__hash=hashed_fingerprint).exists()

            # Be sure we did NOT create this issue using the legacy metrics
            legacy_sent_occurrence_calls = [
                c
                for c in metrics.incr.mock_calls
                if c[1][0] == "uptime.result_processor.active.sent_occurrence"
            ]
            assert len(legacy_sent_occurrence_calls) == 0

        group = Group.objects.get(grouphash__hash=hashed_fingerprint)
        assert group.issue_type == UptimeDomainCheckFailure
        assignee = group.get_assignee()
        assert assignee and (assignee.id == self.user.id)
        self.subscription.refresh_from_db()
        assert self.subscription.uptime_status == UptimeStatus.FAILED

        # Issue is resolved
        with (
            self.feature(features),
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
            mock.patch("sentry.uptime.grouptype.get_active_recovery_threshold", return_value=2),
            # Only needed to make sure we don't inadvertently also attempt to
            # resolve the issue using the legacy system.
            mock.patch(
                "sentry.uptime.consumers.results_consumer.get_active_recovery_threshold",
                return_value=2,
            ),
        ):
            self.send_result(
                self.create_uptime_result(
                    self.subscription.subscription_id,
                    status=CHECKSTATUS_SUCCESS,
                    scheduled_check_time=datetime.now() - timedelta(minutes=3),
                )
            )
            assert not Group.objects.filter(
                grouphash__hash=hashed_fingerprint, status=GroupStatus.RESOLVED
            ).exists()
            self.send_result(
                self.create_uptime_result(
                    self.subscription.subscription_id,
                    status=CHECKSTATUS_SUCCESS,
                    scheduled_check_time=datetime.now() - timedelta(minutes=2),
                )
            )
            # Issue is resolved
            assert Group.objects.filter(
                grouphash__hash=hashed_fingerprint, status=GroupStatus.RESOLVED
            ).exists()

            # Be sure we did NOT create this issue using the legacy metrics
            legacy_resolve_calls = [
                c
                for c in metrics.incr.mock_calls
                if c[1][0] == "uptime.result_processor.active.resolved"
            ]
            assert len(legacy_resolve_calls) == 0

    def test_does_nothing_when_missing_project_subscription(self):
        features = [
            "organizations:uptime",
            "organizations:uptime-create-issues",
            "organizations:uptime-detector-handler",
        ]
        self.detector.delete()

        result = self.create_uptime_result(
            self.subscription.subscription_id,
            scheduled_check_time=datetime.now() - timedelta(minutes=5),
        )
        with (
            self.feature(features),
            mock.patch("sentry.remote_subscriptions.consumers.result_consumer.logger") as logger,
            mock.patch(
                "sentry.uptime.consumers.results_consumer.remove_uptime_subscription_if_unused"
            ) as mock_remove_uptime_subscription_if_unused,
        ):
            # Does not produce an error
            self.send_result(result)
            assert not logger.exception.called
            mock_remove_uptime_subscription_if_unused.assert_called_with(self.subscription)

    def test_restricted_host_provider_id(self):
        """
        Test that we do NOT create an issue when the host provider identifier
        has been restricted using the
        `restrict-issue-creation-by-hosting-provider-id` option.
        """
        features = [
            "organizations:uptime",
            "organizations:uptime-create-issues",
            "organizations:uptime-detector-handler",
        ]
        result = self.create_uptime_result(
            self.subscription.subscription_id,
            scheduled_check_time=datetime.now() - timedelta(minutes=5),
        )
        with (
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
            self.feature(features),
            mock.patch(
                "sentry.uptime.consumers.results_consumer.get_active_failure_threshold",
                return_value=1,
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
        fingerprint = build_detector_fingerprint_component(self.detector).encode("utf-8")
        hashed_fingerprint = md5(fingerprint).hexdigest()
        with pytest.raises(Group.DoesNotExist):
            Group.objects.get(grouphash__hash=hashed_fingerprint)

        # subscription status is still updated
        self.project_subscription.refresh_from_db()
        assert self.project_subscription.uptime_subscription.uptime_status == UptimeStatus.FAILED

    def test_reset_fail_count(self):
        features = [
            "organizations:uptime",
            "organizations:uptime-create-issues",
            "organizations:uptime-detector-handler",
        ]
        with (
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
            self.feature(features),
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

        fingerprint = build_detector_fingerprint_component(self.detector).encode("utf-8")
        hashed_fingerprint = md5(fingerprint).hexdigest()
        with pytest.raises(Group.DoesNotExist):
            Group.objects.get(grouphash__hash=hashed_fingerprint)
        self.project_subscription.refresh_from_db()
        assert self.project_subscription.uptime_subscription.uptime_status == UptimeStatus.OK

    def test_no_create_issues_feature(self):
        result = self.create_uptime_result(self.subscription.subscription_id)
        with (
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
            mock.patch(
                "sentry.uptime.consumers.results_consumer.get_active_failure_threshold",
                return_value=1,
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

        fingerprint = build_detector_fingerprint_component(self.detector).encode("utf-8")
        hashed_fingerprint = md5(fingerprint).hexdigest()
        with pytest.raises(Group.DoesNotExist):
            Group.objects.get(grouphash__hash=hashed_fingerprint)
        self.subscription.refresh_from_db()
        assert self.subscription.uptime_status == UptimeStatus.FAILED

    def test_resolve(self):
        features = [
            "organizations:uptime",
            "organizations:uptime-create-issues",
            "organizations:uptime-detector-handler",
        ]
        with (
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
            self.feature(features),
            mock.patch(
                "sentry.uptime.consumers.results_consumer.get_active_failure_threshold",
                return_value=2,
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

        fingerprint = build_detector_fingerprint_component(self.detector).encode("utf-8")
        hashed_fingerprint = md5(fingerprint).hexdigest()
        group = Group.objects.get(grouphash__hash=hashed_fingerprint)
        assert group.issue_type == UptimeDomainCheckFailure
        assert group.status == GroupStatus.UNRESOLVED
        self.project_subscription.refresh_from_db()
        assert self.project_subscription.uptime_subscription.uptime_status == UptimeStatus.FAILED

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
        assert self.project_subscription.uptime_subscription.uptime_status == UptimeStatus.OK

    def test_no_subscription(self):
        features = [
            "organizations:uptime",
            "organizations:uptime-create-issues",
            "organizations:uptime-detector-handler",
        ]
        subscription_id = uuid.uuid4().hex
        result = self.create_uptime_result(subscription_id, uptime_region="default")
        with (
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
            self.feature(features),
        ):
            self.send_result(result)
            metrics.incr.assert_has_calls(
                [
                    call(
                        "uptime.result_processor.subscription_not_found",
                        tags={"uptime_region": "default"},
                        sample_rate=1.0,
                    )
                ]
            )
            self.assert_redis_config(
                "default", UptimeSubscription(subscription_id=subscription_id), "delete", None
            )

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

    def test_missed_check_false_positive(self):
        result = self.create_uptime_result(self.subscription.subscription_id)

        # Pretend we got a result 3500 seconds ago (nearly an hour); the subscription
        # has an interval of 300 seconds, which we're going to say was just recently
        # changed.  Verify we don't emit any metrics recording of a missed check
        _get_cluster().set(
            build_last_update_key(self.detector),
            int(result["scheduled_check_time_ms"]) - (3500 * 1000),
        )

        _get_cluster().set(
            build_last_seen_interval_key(self.detector),
            3600 * 1000,
        )

        with (
            mock.patch("sentry.uptime.consumers.results_consumer.logger") as logger,
            self.feature(["organizations:uptime", "organizations:uptime-create-issues"]),
        ):
            self.send_result(result)
            logger.info.assert_any_call(
                "uptime.result_processor.false_num_missing_check",
                extra={**result},
            )

    @override_options({"uptime.snuba_uptime_results.enabled": False})
    def test_missed_check_updated_interval(self):
        result = self.create_uptime_result(self.subscription.subscription_id)

        # Pretend we got a result 3500 seconds ago (nearly an hour); the subscription
        # has an interval of 300 seconds, which we're going to say was just recently
        # changed.  Verify we don't emit any metrics recording of a missed check
        _get_cluster().set(
            build_last_update_key(self.detector),
            int(result["scheduled_check_time_ms"]) - (3500 * 1000),
        )

        _get_cluster().set(
            build_last_seen_interval_key(self.detector),
            3600 * 1000,
        )

        with (
            mock.patch("sentry.uptime.consumers.results_consumer.logger") as logger,
            self.feature(["organizations:uptime", "organizations:uptime-create-issues"]),
        ):
            self.send_result(result)
            logger.info.assert_any_call(
                "uptime.result_processor.false_num_missing_check",
                extra={**result},
            )

        # Send another check that should now be classified as a miss
        result = self.create_uptime_result(self.subscription.subscription_id)
        result["scheduled_check_time_ms"] = int(result["scheduled_check_time_ms"]) + (600 * 1000)
        result["actual_check_time_ms"] = result["scheduled_check_time_ms"]
        with (
            mock.patch("sentry.uptime.consumers.results_consumer.logger") as logger,
            self.feature(["organizations:uptime", "organizations:uptime-create-issues"]),
        ):
            self.send_result(result)
            logger.info.assert_any_call(
                "uptime.result_processor.num_missing_check",
                extra={"num_missed_checks": 1, **result},
            )

    def test_missed_check_true_positive(self):
        result = self.create_uptime_result(self.subscription.subscription_id)

        # Pretend we got a result 3500 seconds ago (nearly an hour); the subscription
        # has an interval of 300 seconds, which we're going to say was just recently
        # changed.  Verify we don't emit any metrics recording of a missed check
        _get_cluster().set(
            build_last_update_key(self.detector),
            int(result["scheduled_check_time_ms"]) - (900 * 1000),
        )

        _get_cluster().set(
            build_last_seen_interval_key(self.detector),
            300 * 1000,
        )

        with (
            mock.patch("sentry.uptime.consumers.results_consumer.logger") as logger,
            self.feature(["organizations:uptime", "organizations:uptime-create-issues"]),
        ):
            self.send_result(result)
            logger.info.assert_any_call(
                "uptime.result_processor.num_missing_check",
                extra={"num_missed_checks": 2, **result},
            )

    def test_skip_already_processed(self):
        features = [
            "organizations:uptime",
            "organizations:uptime-create-issues",
            "organizations:uptime-detector-handler",
        ]
        result = self.create_uptime_result(self.subscription.subscription_id)
        _get_cluster().set(
            build_last_update_key(self.detector),
            int(result["scheduled_check_time_ms"]),
        )
        with (
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
            self.feature(features),
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

        fingerprint = build_detector_fingerprint_component(self.detector).encode("utf-8")
        hashed_fingerprint = md5(fingerprint).hexdigest()
        with pytest.raises(Group.DoesNotExist):
            Group.objects.get(grouphash__hash=hashed_fingerprint)

    def test_skip_shadow_region(self):
        features = [
            "organizations:uptime",
            "organizations:uptime-create-issues",
            "organizations:uptime-detector-handler",
        ]
        region_name = "shadow"
        self.create_uptime_subscription_region(
            self.subscription, region_name, UptimeSubscriptionRegion.RegionMode.SHADOW
        )
        result = self.create_uptime_result(
            self.subscription.subscription_id,
            scheduled_check_time=datetime.now() - timedelta(minutes=5),
            uptime_region=region_name,
        )
        with (
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
            self.feature(features),
        ):
            self.send_result(result)
            metrics.incr.assert_has_calls(
                [
                    call(
                        "uptime.result_processor.dropped_shadow_result",
                        sample_rate=1.0,
                        tags={
                            "status": CHECKSTATUS_FAILURE,
                            "host_provider": "TEST",
                            "uptime_region": "shadow",
                        },
                    ),
                ]
            )
        fingerprint = build_detector_fingerprint_component(self.detector).encode("utf-8")
        hashed_fingerprint = md5(fingerprint).hexdigest()
        with pytest.raises(Group.DoesNotExist):
            Group.objects.get(grouphash__hash=hashed_fingerprint)

    @override_options({"uptime.snuba_uptime_results.enabled": False})
    def test_missed(self):
        features = [
            "organizations:uptime",
            "organizations:uptime-create-issues",
            "organizations:uptime-detector-handler",
        ]
        result = self.create_uptime_result(
            self.subscription.subscription_id, status=CHECKSTATUS_MISSED_WINDOW
        )
        with (
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
            mock.patch("sentry.uptime.consumers.results_consumer.logger") as logger,
            self.feature(features),
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
        fingerprint = build_detector_fingerprint_component(self.detector).encode("utf-8")
        hashed_fingerprint = md5(fingerprint).hexdigest()
        with pytest.raises(Group.DoesNotExist):
            Group.objects.get(grouphash__hash=hashed_fingerprint)

    def test_onboarding_failure(self):
        features = [
            "organizations:uptime",
            "organizations:uptime-create-issues",
            "organizations:uptime-detector-handler",
        ]
        self.project_subscription.update(mode=UptimeMonitorMode.AUTO_DETECTED_ONBOARDING)
        self.detector.update(
            config={
                **self.detector.config,
                "mode": UptimeMonitorMode.AUTO_DETECTED_ONBOARDING.value,
            }
        )

        result = self.create_uptime_result(
            self.subscription.subscription_id,
            status=CHECKSTATUS_FAILURE,
            scheduled_check_time=datetime.now() - timedelta(minutes=5),
        )
        redis = _get_cluster()
        key = build_onboarding_failure_key(self.detector)
        assert redis.get(key) is None
        with (
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
            self.feature(features),
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

        fingerprint = build_detector_fingerprint_component(self.detector).encode("utf-8")
        hashed_fingerprint = md5(fingerprint).hexdigest()
        with pytest.raises(Group.DoesNotExist):
            Group.objects.get(grouphash__hash=hashed_fingerprint)

        result = self.create_uptime_result(
            self.subscription.subscription_id,
            status=CHECKSTATUS_FAILURE,
            scheduled_check_time=datetime.now() - timedelta(minutes=4),
        )
        with (
            mock.patch("sentry.quotas.backend.remove_seat") as mock_remove_seat,
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as consumer_metrics,
            mock.patch("sentry.uptime.detectors.result_handler.metrics") as onboarding_metrics,
            mock.patch(
                "sentry.uptime.detectors.result_handler.ONBOARDING_FAILURE_THRESHOLD", new=2
            ),
            self.tasks(),
            self.feature(features),
        ):
            remove_call_vals = []

            def capture_remove_seat(data_category, seat_object):
                remove_call_vals.append((data_category, seat_object.id))

            mock_remove_seat.side_effect = capture_remove_seat

            self.send_result(result)
            consumer_metrics.incr.assert_has_calls(
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
            onboarding_metrics.incr.assert_has_calls(
                [
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
        # XXX: Since project_subscription is mutable, the delete sets the id to null. So we're unable
        # to compare the calls directly. Instead, we add a side effect to the mock so that it keeps track of
        # the values we want to check.
        assert remove_call_vals == [(DataCategory.UPTIME, self.project_subscription.id)]

        fingerprint = build_detector_fingerprint_component(self.detector).encode("utf-8")
        hashed_fingerprint = md5(fingerprint).hexdigest()
        with pytest.raises(Group.DoesNotExist):
            Group.objects.get(grouphash__hash=hashed_fingerprint)
        with pytest.raises(UptimeSubscription.DoesNotExist):
            self.subscription.refresh_from_db()
        with pytest.raises(ProjectUptimeSubscription.DoesNotExist):
            self.project_subscription.refresh_from_db()

    def test_onboarding_success_ongoing(self):
        features = [
            "organizations:uptime",
            "organizations:uptime-create-issues",
            "organizations:uptime-detector-handler",
        ]
        self.project_subscription.update(
            mode=UptimeMonitorMode.AUTO_DETECTED_ONBOARDING,
            date_added=datetime.now(timezone.utc) - timedelta(minutes=5),
        )
        self.detector.update(
            config={
                **self.detector.config,
                "mode": UptimeMonitorMode.AUTO_DETECTED_ONBOARDING.value,
            },
            date_added=datetime.now(timezone.utc)
            - (ONBOARDING_MONITOR_PERIOD + timedelta(minutes=5)),
        )
        result = self.create_uptime_result(
            self.subscription.subscription_id,
            status=CHECKSTATUS_SUCCESS,
            scheduled_check_time=datetime.now() - timedelta(minutes=5),
        )
        redis = _get_cluster()
        key = build_onboarding_failure_key(self.detector)
        assert redis.get(key) is None
        with (
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
            self.feature(features),
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

        fingerprint = build_detector_fingerprint_component(self.detector).encode("utf-8")
        hashed_fingerprint = md5(fingerprint).hexdigest()
        with pytest.raises(Group.DoesNotExist):
            Group.objects.get(grouphash__hash=hashed_fingerprint)

    def test_onboarding_success_graduate(self):
        features = [
            "organizations:uptime",
            "organizations:uptime-create-issues",
            "organizations:uptime-detector-handler",
        ]
        self.project_subscription.update(
            mode=UptimeMonitorMode.AUTO_DETECTED_ONBOARDING,
            date_added=datetime.now(timezone.utc)
            - (ONBOARDING_MONITOR_PERIOD + timedelta(minutes=5)),
        )
        self.detector.update(
            config={
                **self.detector.config,
                "mode": UptimeMonitorMode.AUTO_DETECTED_ONBOARDING.value,
            },
            date_added=datetime.now(timezone.utc)
            - (ONBOARDING_MONITOR_PERIOD + timedelta(minutes=5)),
        )

        result = self.create_uptime_result(
            self.subscription.subscription_id,
            status=CHECKSTATUS_SUCCESS,
            scheduled_check_time=datetime.now() - timedelta(minutes=2),
        )
        redis = _get_cluster()
        key = build_onboarding_failure_key(self.detector)
        assert redis.get(key) is None
        with (
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as consumer_metrics,
            mock.patch("sentry.uptime.detectors.result_handler.metrics") as onboarding_metrics,
            self.tasks(),
            self.feature(features),
        ):
            self.send_result(result)
            consumer_metrics.incr.assert_has_calls(
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
            onboarding_metrics.incr.assert_has_calls(
                [
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

        fingerprint = build_detector_fingerprint_component(self.detector).encode("utf-8")
        hashed_fingerprint = md5(fingerprint).hexdigest()
        with pytest.raises(Group.DoesNotExist):
            Group.objects.get(grouphash__hash=hashed_fingerprint)

        self.project_subscription.refresh_from_db()
        assert self.project_subscription.mode == UptimeMonitorMode.AUTO_DETECTED_ACTIVE
        self.subscription.refresh_from_db()
        assert self.subscription.interval_seconds == int(
            AUTO_DETECTED_ACTIVE_SUBSCRIPTION_INTERVAL.total_seconds()
        )
        assert self.subscription.url == self.subscription.url

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
            mock_processor_call.assert_has_calls(
                [call("uptime", result_1), call("uptime", result_2), call("uptime", result_3)]
            )

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

    @override_options({"uptime.snuba_uptime_results.enabled": False})
    def test_provider_stats(self):
        features = [
            "organizations:uptime",
            "organizations:uptime-create-issues",
            "organizations:uptime-detector-handler",
        ]
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
            self.feature(features),
            mock.patch(
                "sentry.uptime.consumers.results_consumer.get_active_failure_threshold",
                return_value=2,
            ),
            mock.patch(
                "sentry.uptime.consumers.results_consumer.TOTAL_PROVIDERS_TO_INCLUDE_AS_TAGS",
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
            status=CHECKSTATUS_SUCCESS,
            scheduled_check_time=datetime.now() - timedelta(minutes=5),
        )
        self.send_result(result)
        mock_produce.assert_called_once()

        assert mock_produce.call_args.args[0].name == "snuba-uptime-results"

        parsed_value = json.loads(mock_produce.call_args.args[1].value)
        assert parsed_value["organization_id"] == self.project.organization_id
        assert parsed_value["project_id"] == self.project.id
        assert parsed_value["incident_status"] == 0
        assert parsed_value["retention_days"] == 90

    @mock.patch("sentry.uptime.consumers.results_consumer._snuba_uptime_checks_producer.produce")
    @mock.patch(
        "sentry.uptime.consumers.results_consumer.get_active_failure_threshold",
        return_value=1,
    )
    @override_options({"uptime.snuba_uptime_results.enabled": True})
    def test_produces_snuba_uptime_results_in_incident(self, _, mock_produce) -> None:
        """
        Validates that the consumer produces a message to Snuba's Kafka topic for uptime check results
        """
        result = self.create_uptime_result(
            self.subscription.subscription_id,
            status=CHECKSTATUS_FAILURE,
            scheduled_check_time=datetime.now() - timedelta(minutes=5),
        )
        self.send_result(result)
        mock_produce.assert_called_once()

        assert mock_produce.call_args.args[0].name == "snuba-uptime-results"

        parsed_value = json.loads(mock_produce.call_args.args[1].value)
        assert parsed_value["incident_status"] == 1

    @mock.patch("sentry.uptime.consumers.eap_producer._eap_items_producer.produce")
    def test_produces_eap_uptime_results(self, mock_produce) -> None:
        """
        Validates that the consumer produces TraceItems to EAP's Kafka topic for uptime check results
        """
        with self.feature("organizations:uptime-eap-results"):
            result = self.create_uptime_result(
                self.subscription.subscription_id,
                status=CHECKSTATUS_SUCCESS,
                scheduled_check_time=datetime.now() - timedelta(minutes=5),
            )
            self.send_result(result)
            mock_produce.assert_called_once()

            assert "snuba-items" in mock_produce.call_args.args[0].name
            payload = mock_produce.call_args.args[1]
            assert payload.key is None
            assert payload.headers == []

            expected_trace_items = convert_uptime_result_to_trace_items(
                self.project, result, IncidentStatus.NO_INCIDENT
            )
            codec = get_topic_codec(KafkaTopic.SNUBA_ITEMS)
            assert [codec.decode(payload.value)] == expected_trace_items

    def run_check_and_update_region_test(
        self,
        sub: UptimeSubscription,
        regions: list[str],
        region_overrides: dict[str, UptimeSubscriptionRegion.RegionMode],
        expected_regions_before: dict[str, UptimeSubscriptionRegion.RegionMode],
        expected_regions_after: dict[str, UptimeSubscriptionRegion.RegionMode],
        expected_config_updates: list[
            tuple[str, str | None, UptimeSubscriptionRegion.RegionMode | None]
        ],
        current_minute=5,
    ):
        region_configs = [
            UptimeRegionConfig(slug=slug, name=slug, config_redis_key_prefix=slug)
            for slug in regions
        ]

        with (
            override_settings(UPTIME_REGIONS=region_configs),
            override_options({"uptime.checker-regions-mode-override": region_overrides}),
            self.tasks(),
            freeze_time((datetime.now() - timedelta(hours=1)).replace(minute=current_minute)),
            mock.patch("random.random", return_value=1),
        ):
            result = self.create_uptime_result(
                sub.subscription_id,
                scheduled_check_time=datetime.now(),
            )
            assert {
                r.region_slug: UptimeSubscriptionRegion.RegionMode(r.mode)
                for r in sub.regions.all()
            } == expected_regions_before
            self.send_result(result)
            sub.refresh_from_db()
            assert {
                r.region_slug: UptimeSubscriptionRegion.RegionMode(r.mode)
                for r in sub.regions.all()
            } == expected_regions_after
            for expected_region, expected_action, expected_mode in expected_config_updates:
                self.assert_redis_config(expected_region, sub, expected_action, expected_mode)
            assert sub.status == UptimeSubscription.Status.ACTIVE.value

    def test_check_and_update_regions(self):
        sub = self.create_uptime_subscription(
            subscription_id=uuid.UUID(int=5).hex,
            region_slugs=["region1"],
        )
        self.create_project_uptime_subscription(uptime_subscription=sub)
        self.run_check_and_update_region_test(
            sub,
            ["region1", "region2"],
            {},
            {"region1": UptimeSubscriptionRegion.RegionMode.ACTIVE},
            {"region1": UptimeSubscriptionRegion.RegionMode.ACTIVE},
            [],
            4,
        )
        self.run_check_and_update_region_test(
            sub,
            ["region1", "region2"],
            {},
            {"region1": UptimeSubscriptionRegion.RegionMode.ACTIVE},
            {
                "region1": UptimeSubscriptionRegion.RegionMode.ACTIVE,
                "region2": UptimeSubscriptionRegion.RegionMode.ACTIVE,
            },
            [
                ("region1", "upsert", UptimeSubscriptionRegion.RegionMode.ACTIVE),
                ("region2", "upsert", UptimeSubscriptionRegion.RegionMode.ACTIVE),
            ],
            5,
        )

    def test_check_and_update_regions_active_shadow(self):
        sub = self.create_uptime_subscription(
            subscription_id=uuid.UUID(int=5).hex,
            region_slugs=["region1", "region2"],
        )
        self.create_project_uptime_subscription(uptime_subscription=sub)
        self.run_check_and_update_region_test(
            sub,
            ["region1", "region2"],
            {"region2": UptimeSubscriptionRegion.RegionMode.SHADOW},
            {
                "region1": UptimeSubscriptionRegion.RegionMode.ACTIVE,
                "region2": UptimeSubscriptionRegion.RegionMode.ACTIVE,
            },
            {
                "region1": UptimeSubscriptionRegion.RegionMode.ACTIVE,
                "region2": UptimeSubscriptionRegion.RegionMode.SHADOW,
            },
            [
                ("region1", "upsert", UptimeSubscriptionRegion.RegionMode.ACTIVE),
                ("region2", "upsert", UptimeSubscriptionRegion.RegionMode.SHADOW),
            ],
            5,
        )

    def test_check_and_update_regions_larger_interval(self):
        # Create subscription with only one region
        hour_sub = self.create_uptime_subscription(
            subscription_id=uuid.UUID(int=4).hex,
            region_slugs=["region1"],
            interval_seconds=UptimeSubscription.IntervalSeconds.ONE_HOUR,
        )
        self.create_project_uptime_subscription(uptime_subscription=hour_sub)
        self.run_check_and_update_region_test(
            hour_sub,
            ["region1", "region2"],
            {},
            {"region1": UptimeSubscriptionRegion.RegionMode.ACTIVE},
            {
                "region1": UptimeSubscriptionRegion.RegionMode.ACTIVE,
                "region2": UptimeSubscriptionRegion.RegionMode.ACTIVE,
            },
            [
                ("region1", "upsert", UptimeSubscriptionRegion.RegionMode.ACTIVE),
                ("region2", "upsert", UptimeSubscriptionRegion.RegionMode.ACTIVE),
            ],
            37,
        )

        five_min_sub = self.create_uptime_subscription(
            subscription_id=uuid.UUID(int=6).hex,
            region_slugs=["region1"],
            interval_seconds=UptimeSubscription.IntervalSeconds.FIVE_MINUTES,
        )
        self.create_project_uptime_subscription(uptime_subscription=five_min_sub)
        self.run_check_and_update_region_test(
            five_min_sub,
            ["region1", "region2"],
            {},
            {"region1": UptimeSubscriptionRegion.RegionMode.ACTIVE},
            {"region1": UptimeSubscriptionRegion.RegionMode.ACTIVE},
            [],
            current_minute=6,
        )
        self.run_check_and_update_region_test(
            five_min_sub,
            ["region1", "region2"],
            {},
            {"region1": UptimeSubscriptionRegion.RegionMode.ACTIVE},
            {"region1": UptimeSubscriptionRegion.RegionMode.ACTIVE},
            [],
            current_minute=35,
        )
        self.run_check_and_update_region_test(
            five_min_sub,
            ["region1", "region2"],
            {},
            {"region1": UptimeSubscriptionRegion.RegionMode.ACTIVE},
            {"region1": UptimeSubscriptionRegion.RegionMode.ACTIVE},
            [],
            current_minute=49,
        )
        self.run_check_and_update_region_test(
            five_min_sub,
            ["region1", "region2"],
            {},
            {"region1": UptimeSubscriptionRegion.RegionMode.ACTIVE},
            {
                "region1": UptimeSubscriptionRegion.RegionMode.ACTIVE,
                "region2": UptimeSubscriptionRegion.RegionMode.ACTIVE,
            },
            [
                ("region1", "upsert", UptimeSubscriptionRegion.RegionMode.ACTIVE),
                ("region2", "upsert", UptimeSubscriptionRegion.RegionMode.ACTIVE),
            ],
            current_minute=30,
        )
        # Make sure it works any time within the valid window
        five_min_sub = self.create_uptime_subscription(
            subscription_id=uuid.UUID(int=66).hex,
            region_slugs=["region1"],
            interval_seconds=UptimeSubscription.IntervalSeconds.FIVE_MINUTES,
        )
        self.create_project_uptime_subscription(uptime_subscription=five_min_sub)
        self.run_check_and_update_region_test(
            five_min_sub,
            ["region1", "region2"],
            {},
            {"region1": UptimeSubscriptionRegion.RegionMode.ACTIVE},
            {
                "region1": UptimeSubscriptionRegion.RegionMode.ACTIVE,
                "region2": UptimeSubscriptionRegion.RegionMode.ACTIVE,
            },
            [
                ("region1", "upsert", UptimeSubscriptionRegion.RegionMode.ACTIVE),
                ("region2", "upsert", UptimeSubscriptionRegion.RegionMode.ACTIVE),
            ],
            current_minute=34,
        )

    def test_check_and_update_regions_removes_disabled(self):
        sub = self.create_uptime_subscription(
            subscription_id=uuid.UUID(int=5).hex,
            region_slugs=["region1", "region2"],
        )
        self.create_project_uptime_subscription(uptime_subscription=sub)
        self.run_check_and_update_region_test(
            sub,
            ["region1", "region2"],
            {"region2": UptimeSubscriptionRegion.RegionMode.INACTIVE},
            {
                "region1": UptimeSubscriptionRegion.RegionMode.ACTIVE,
                "region2": UptimeSubscriptionRegion.RegionMode.ACTIVE,
            },
            {
                "region1": UptimeSubscriptionRegion.RegionMode.ACTIVE,
                "region2": UptimeSubscriptionRegion.RegionMode.ACTIVE,
            },
            [],
            current_minute=4,
        )
        self.run_check_and_update_region_test(
            sub,
            ["region1", "region2"],
            {"region2": UptimeSubscriptionRegion.RegionMode.INACTIVE},
            {
                "region1": UptimeSubscriptionRegion.RegionMode.ACTIVE,
                "region2": UptimeSubscriptionRegion.RegionMode.ACTIVE,
            },
            {"region1": UptimeSubscriptionRegion.RegionMode.ACTIVE},
            [
                ("region1", "upsert", UptimeSubscriptionRegion.RegionMode.ACTIVE),
                ("region2", "delete", None),
            ],
            current_minute=5,
        )


@thread_leaks.allowlist(issue=-1, reason="KafkaProducer cleanup")
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
            self.create_project_uptime_subscription(uptime_subscription=subscription_2)

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
            mock_processor_call.assert_has_calls(
                [call("uptime", result_1), call("uptime", result_2), call("uptime", result_3)]
            )

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
        self.create_project_uptime_subscription(uptime_subscription=subscription_2)

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


@thread_leaks.allowlist(issue=-1, reason="KafkaProducer cleanup")
class ProcessResultParallelTest(ProcessResultTest):
    strategy_processing_mode = "parallel"
