import abc
import uuid
from datetime import datetime, timedelta, timezone
from hashlib import md5
from typing import Literal
from unittest import mock
from unittest.mock import MagicMock, call

import pytest
from arroyo import Message
from arroyo.backends.kafka import KafkaPayload
from arroyo.processing.strategies import ProcessingStrategy
from arroyo.types import BrokerValue, Partition, Topic
from django.test import override_settings
from sentry_kafka_schemas.schema_types.uptime_results_v1 import (
    CHECKSTATUS_DISALLOWED_BY_ROBOTS,
    CHECKSTATUS_FAILURE,
    CHECKSTATUS_MISSED_WINDOW,
    CHECKSTATUS_SUCCESS,
    CHECKSTATUSREASONTYPE_TIMEOUT,
    CheckResult,
)
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem

from sentry.conf.types import kafka_definition
from sentry.conf.types.kafka_definition import Topic as KafkaTopic
from sentry.conf.types.kafka_definition import get_topic_codec
from sentry.conf.types.uptime import UptimeRegionConfig
from sentry.constants import ObjectStatus
from sentry.models.group import Group, GroupStatus
from sentry.quotas.base import SeatAssignmentResult
from sentry.testutils.abstract import Abstract
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.helpers.options import override_options
from sentry.testutils.thread_leaks.pytest import thread_leak_allowlist
from sentry.uptime.autodetect.result_handler import (
    AUTO_DETECTED_ACTIVE_SUBSCRIPTION_INTERVAL,
    ONBOARDING_MONITOR_PERIOD,
    build_onboarding_failure_key,
)
from sentry.uptime.autodetect.tasks import is_failed_url
from sentry.uptime.consumers.eap_converter import convert_uptime_result_to_trace_items
from sentry.uptime.consumers.results_consumer import UptimeResultsStrategyFactory
from sentry.uptime.grouptype import UptimeDomainCheckFailure
from sentry.uptime.models import UptimeSubscription, UptimeSubscriptionRegion
from sentry.uptime.subscriptions.subscriptions import (
    UptimeMonitorNoSeatAvailable,
    disable_uptime_detector,
    enable_uptime_detector,
)
from sentry.uptime.types import IncidentStatus, UptimeMonitorMode
from sentry.uptime.utils import (
    build_backlog_key,
    build_detector_fingerprint_component,
    build_last_seen_interval_key,
    build_last_update_key,
    get_cluster,
)
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.uptime.subscriptions.test_tasks import ConfigPusherTestMixin


@thread_leak_allowlist(reason="uptime consumers", issue=97045)
class ProcessResultTest(ConfigPusherTestMixin, metaclass=abc.ABCMeta):
    __test__ = Abstract(__module__, __qualname__)

    @property
    @abc.abstractmethod
    def strategy_processing_mode(self) -> Literal["batched-parallel", "parallel", "serial"]:
        pass

    def setUp(self) -> None:
        super().setUp()
        self.partition = Partition(Topic("test"), 0)
        self.subscription = self.create_uptime_subscription(
            subscription_id=uuid.uuid4().hex, interval_seconds=300, region_slugs=["default"]
        )
        self.detector = self.create_uptime_detector(
            uptime_subscription=self.subscription,
            downtime_threshold=2,
            recovery_threshold=2,
            owner=self.user,
        )

    def send_result(
        self, result: CheckResult, consumer: ProcessingStrategy[KafkaPayload] | None = None
    ):
        codec = kafka_definition.get_topic_codec(kafka_definition.Topic.UPTIME_RESULTS)
        message = Message(
            BrokerValue(
                KafkaPayload(None, codec.encode(result), []),
                self.partition,
                1,
                datetime.now(),
            )
        )
        with self.feature(UptimeDomainCheckFailure.build_ingest_feature_name()):
            if consumer is None:
                factory = UptimeResultsStrategyFactory(
                    consumer_group="test", mode=self.strategy_processing_mode
                )
                commit = mock.Mock()
                consumer = factory.create_with_partitions(commit, {self.partition: 0})

            consumer.submit(message)

    def decode_trace_item(self, payload_value: bytes) -> TraceItem:
        """Helper to decode a TraceItem from the produced Kafka payload."""
        codec = get_topic_codec(KafkaTopic.SNUBA_ITEMS)
        return codec.decode(payload_value)

    def test(self) -> None:
        fingerprint = build_detector_fingerprint_component(self.detector).encode("utf-8")
        hashed_fingerprint = md5(fingerprint).hexdigest()
        with (
            self.feature("organizations:uptime"),
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
        ):
            # First processed result does NOT create an occurrence since we
            # have not yet met the active threshold
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
            assert not Group.objects.filter(grouphash__hash=hashed_fingerprint).exists()
            metrics.incr.reset_mock()

            # Second processed result DOES create an occurrence since we met
            # the threshold
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

        group = Group.objects.get(grouphash__hash=hashed_fingerprint)
        assert group.issue_type == UptimeDomainCheckFailure
        assignee = group.get_assignee()
        assert assignee and (assignee.id == self.user.id)
        self.detector.refresh_from_db()
        detector_state = self.detector.detectorstate_set.first()
        assert detector_state is not None
        assert detector_state.priority_level == DetectorPriorityLevel.HIGH
        assert detector_state.is_triggered

        # Issue is resolved
        with self.feature("organizations:uptime"):
            # First processed result does NOT resolve since we have not yet met
            # the recovery threshold
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

            # Issue is resolved once the threshold is met
            self.send_result(
                self.create_uptime_result(
                    self.subscription.subscription_id,
                    status=CHECKSTATUS_SUCCESS,
                    scheduled_check_time=datetime.now() - timedelta(minutes=2),
                )
            )
            assert Group.objects.filter(
                grouphash__hash=hashed_fingerprint, status=GroupStatus.RESOLVED
            ).exists()

    def test_does_nothing_when_missing_detector(self) -> None:
        features = [
            "organizations:uptime",
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
                "sentry.uptime.consumers.results_consumer.delete_uptime_subscription"
            ) as mock_delete_uptime_subscription,
        ):
            # Does not produce an error
            self.send_result(result)
            assert not logger.exception.called
            mock_delete_uptime_subscription.assert_called_with(self.subscription)

    def test_no_create_issues_option(self) -> None:
        self.detector.config.update({"downtime_threshold": 1, "recovery_threshold": 1})
        self.detector.save()
        result = self.create_uptime_result(self.subscription.subscription_id)
        with (
            self.options({"uptime.create-issues": False}),
            self.feature("organizations:uptime"),
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
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
        self.detector.refresh_from_db()
        detector_state = self.detector.detectorstate_set.first()
        assert detector_state is not None
        assert detector_state.priority_level == DetectorPriorityLevel.HIGH
        assert detector_state.is_triggered

    def test_no_subscription(self) -> None:
        features = [
            "organizations:uptime",
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

    def test_organization_feature_disabled(self) -> None:
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

    def test_missed_check_false_positive(self) -> None:
        result = self.create_uptime_result(self.subscription.subscription_id)

        # Pretend we got a result 3500 seconds ago (nearly an hour); the subscription
        # has an interval of 300 seconds, which we're going to say was just recently
        # changed.  Verify we don't emit any metrics recording of a missed check
        get_cluster().set(
            build_last_update_key(self.detector),
            int(result["scheduled_check_time_ms"]) - (3500 * 1000),
        )

        get_cluster().set(
            build_last_seen_interval_key(self.detector),
            3600 * 1000,
        )

        with (
            mock.patch("sentry.uptime.consumers.results_consumer.logger") as logger,
            self.feature("organizations:uptime"),
        ):
            self.send_result(result)
            logger.info.assert_any_call(
                "uptime.result_processor.false_num_missing_check",
                extra={**result},
            )

    def test_missed_check_updated_interval(self) -> None:
        result = self.create_uptime_result(self.subscription.subscription_id)

        # Pretend we got a result 3500 seconds ago (nearly an hour); the subscription
        # has an interval of 300 seconds, which we're going to say was just recently
        # changed.  Verify we don't emit any metrics recording of a missed check
        get_cluster().set(
            build_last_update_key(self.detector),
            int(result["scheduled_check_time_ms"]) - (3500 * 1000),
        )

        get_cluster().set(
            build_last_seen_interval_key(self.detector),
            3600 * 1000,
        )

        with (
            mock.patch("sentry.uptime.consumers.results_consumer.logger") as logger,
            self.feature("organizations:uptime"),
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
            self.feature("organizations:uptime"),
        ):
            self.send_result(result)
            logger.info.assert_any_call(
                "uptime.result_processor.num_missing_check",
                extra={"num_missed_checks": 1, **result},
            )

    @mock.patch("sentry.uptime.consumers.eap_producer._eap_items_producer.produce")
    def test_no_missed_check_for_disabled(self, mock_produce: MagicMock) -> None:
        result = self.create_uptime_result(self.subscription.subscription_id)

        # Pretend we got a result 900 seconds ago; the subscription
        # has an interval of 300 seconds.  We've missed two checks.
        last_update_time = int(result["scheduled_check_time_ms"]) - (900 * 1000)
        get_cluster().set(
            build_last_update_key(self.detector),
            last_update_time,
        )

        get_cluster().set(
            build_last_seen_interval_key(self.detector),
            300 * 1000,
        )

        # Enabling and disabling should clear the last_update_time, and we
        # will not produce any synthetic checks
        disable_uptime_detector(self.detector)
        enable_uptime_detector(self.detector)

        with (self.feature("organizations:uptime"),):
            self.send_result(result)

            assert mock_produce.call_count == 1

            check = self.decode_trace_item(mock_produce.call_args_list[0].args[1].value)

            assert check.attributes["check_status"].string_value == "failure"

    @mock.patch("sentry.uptime.consumers.eap_producer._eap_items_producer.produce")
    def test_missed_check_true_positive(self, mock_produce: MagicMock) -> None:
        result = self.create_uptime_result(self.subscription.subscription_id)

        # Pretend we got a result 900 seconds ago; the subscription
        # has an interval of 300 seconds.  We've missed two checks.
        last_update_time = int(result["scheduled_check_time_ms"]) - (900 * 1000)
        get_cluster().set(
            build_last_update_key(self.detector),
            last_update_time,
        )

        get_cluster().set(
            build_last_seen_interval_key(self.detector),
            300 * 1000,
        )

        with (
            mock.patch("sentry.uptime.consumers.results_consumer.logger") as logger,
            self.feature("organizations:uptime"),
        ):
            self.send_result(result)

            assert mock_produce.call_count == 3

            synth_1 = self.decode_trace_item(mock_produce.call_args_list[0].args[1].value)
            synth_2 = self.decode_trace_item(mock_produce.call_args_list[1].args[1].value)
            synth_3 = self.decode_trace_item(mock_produce.call_args_list[2].args[1].value)

            assert synth_1.attributes["check_status"].string_value == "missed_window"
            assert synth_2.attributes["check_status"].string_value == "missed_window"
            assert synth_3.attributes["check_status"].string_value == "failure"

            # Verify backfilled misses have the correct status_reason
            assert synth_1.attributes["status_reason_type"].string_value == "miss_backfill"
            assert (
                synth_1.attributes["status_reason_description"].string_value
                == "Miss was never reported for this scheduled check_time"
            )
            assert synth_2.attributes["status_reason_type"].string_value == "miss_backfill"
            assert (
                synth_2.attributes["status_reason_description"].string_value
                == "Miss was never reported for this scheduled check_time"
            )

            # Verify backfilled misses use UUIDs without dashes (simple format)
            assert "-" not in synth_1.attributes["guid"].string_value
            assert "-" not in synth_1.trace_id
            assert "-" not in synth_1.attributes["span_id"].string_value

            assert (
                synth_1.attributes["scheduled_check_time_us"].int_value
                == (last_update_time + 300 * 1000) * 1000
            )
            assert (
                synth_2.attributes["scheduled_check_time_us"].int_value
                == (last_update_time + 600 * 1000) * 1000
            )

            logger.info.assert_any_call(
                "uptime.result_processor.num_missing_check",
                extra={"num_missed_checks": 2, **result},
            )

    def test_skip_already_processed(self) -> None:
        features = [
            "organizations:uptime",
        ]
        result = self.create_uptime_result(self.subscription.subscription_id)
        get_cluster().set(
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

    def test_skip_shadow_region(self) -> None:
        features = [
            "organizations:uptime",
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

    def test_missed(self) -> None:
        features = [
            "organizations:uptime",
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

    def test_disallowed(self) -> None:
        features = [
            "organizations:uptime",
            "organizations:uptime-create-issues",
        ]
        result = self.create_uptime_result(
            self.subscription.subscription_id, status=CHECKSTATUS_DISALLOWED_BY_ROBOTS
        )
        with (
            mock.patch("sentry.uptime.consumers.results_consumer.logger") as logger,
            self.feature(features),
        ):
            assert self.detector.enabled

            self.send_result(result)

            logger.info.assert_any_call(
                "disallowed_by_robots",
                extra={**result},
            )

            self.detector.refresh_from_db()
            assert not self.detector.enabled

    def test_onboarding_failure(self) -> None:
        features = [
            "organizations:uptime",
        ]
        # Update detector mode configuration
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
        redis = get_cluster()
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
            mock.patch("sentry.uptime.autodetect.result_handler.metrics") as onboarding_metrics,
            mock.patch(
                "sentry.uptime.autodetect.result_handler.ONBOARDING_FAILURE_THRESHOLD", new=2
            ),
            self.tasks(),
            self.feature(features),
        ):
            remove_call_vals = []

            def capture_remove_seat(data_category=None, seat_object=None):
                remove_call_vals.append(seat_object.id)

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
        assert remove_call_vals == [self.detector.id]

        fingerprint = build_detector_fingerprint_component(self.detector).encode("utf-8")
        hashed_fingerprint = md5(fingerprint).hexdigest()
        with pytest.raises(Group.DoesNotExist):
            Group.objects.get(grouphash__hash=hashed_fingerprint)
        with pytest.raises(UptimeSubscription.DoesNotExist):
            self.subscription.refresh_from_db()
        # Detector should be marked for pending deletion when subscription is removed
        self.detector.refresh_from_db()
        assert self.detector.status == ObjectStatus.PENDING_DELETION

    def test_onboarding_success_ongoing(self) -> None:
        features = [
            "organizations:uptime",
        ]
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
        redis = get_cluster()
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

    def test_onboarding_success_graduate(self) -> None:
        features = [
            "organizations:uptime",
        ]
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
        redis = get_cluster()
        key = build_onboarding_failure_key(self.detector)
        assert redis.get(key) is None
        with (
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as consumer_metrics,
            mock.patch("sentry.uptime.autodetect.result_handler.metrics") as onboarding_metrics,
            mock.patch(
                "sentry.uptime.autodetect.result_handler.send_auto_detected_notifications"
            ) as mock_email_task,
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
            mock_email_task.delay.assert_called_once_with(self.detector.id)
        assert not redis.exists(key)

        fingerprint = build_detector_fingerprint_component(self.detector).encode("utf-8")
        hashed_fingerprint = md5(fingerprint).hexdigest()
        with pytest.raises(Group.DoesNotExist):
            Group.objects.get(grouphash__hash=hashed_fingerprint)

        self.detector.refresh_from_db()
        assert self.detector.config["mode"] == UptimeMonitorMode.AUTO_DETECTED_ACTIVE.value
        self.subscription.refresh_from_db()
        assert self.subscription.interval_seconds == int(
            AUTO_DETECTED_ACTIVE_SUBSCRIPTION_INTERVAL.total_seconds()
        )
        assert self.subscription.url == self.subscription.url

    def test_onboarding_graduation_no_seat_available(self) -> None:
        """
        Test that when an onboarding monitor tries to graduate to active status
        but no seat is available, the detector is deleted.
        """
        features = [
            "organizations:uptime",
        ]
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

        redis = get_cluster()
        key = build_onboarding_failure_key(self.detector)
        assert redis.get(key) is None

        with (
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as consumer_metrics,
            mock.patch("sentry.uptime.autodetect.result_handler.metrics") as onboarding_metrics,
            mock.patch("sentry.uptime.autodetect.result_handler.logger") as onboarding_logger,
            mock.patch(
                "sentry.uptime.autodetect.result_handler.update_uptime_detector",
                side_effect=UptimeMonitorNoSeatAvailable(
                    SeatAssignmentResult(assignable=False, reason="Testing")
                ),
            ),
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

            onboarding_metrics.incr.assert_called_once_with(
                "uptime.result_processor.autodetection.graduated_onboarding_no_seat",
                tags={
                    "status": CHECKSTATUS_SUCCESS,
                    "uptime_region": "us-west",
                    "host_provider": "TEST",
                },
                sample_rate=1.0,
            )

            onboarding_logger.info.assert_called_once_with(
                "uptime_onboarding_graduated_no_seat",
                extra={
                    "project_id": self.detector.project_id,
                    "url": self.subscription.url,
                    **result,
                },
            )

        self.detector.refresh_from_db()
        assert self.detector.status == ObjectStatus.PENDING_DELETION

        with pytest.raises(UptimeSubscription.DoesNotExist):
            self.subscription.refresh_from_db()

        assert not redis.exists(key)

        fingerprint = build_detector_fingerprint_component(self.detector).encode("utf-8")
        hashed_fingerprint = md5(fingerprint).hexdigest()
        with pytest.raises(Group.DoesNotExist):
            Group.objects.get(grouphash__hash=hashed_fingerprint)

    def test_parallel(self) -> None:
        """
        Validates that the consumer in parallel mode correctly groups check-ins
        into groups by their monitor slug / environment
        """

        factory = UptimeResultsStrategyFactory(
            consumer_group="test",
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
    def test_parallel_grouping(self, mock_process_group: MagicMock) -> None:
        """
        Validates that the consumer in parallel mode correctly groups check-ins
        into groups by their monitor slug / environment
        """

        factory = UptimeResultsStrategyFactory(
            consumer_group="test",
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

    def test_provider_stats(self) -> None:
        features = [
            "organizations:uptime",
        ]
        subscription = self.create_uptime_subscription(
            subscription_id=uuid.uuid4().hex,
            host_provider_name="test_provider",
        )
        self.create_uptime_detector(self.project, uptime_subscription=subscription)
        self.create_uptime_subscription(
            subscription_id=uuid.uuid4().hex,
            host_provider_name="test_provider",
        )

        with (
            self.feature(features),
            mock.patch("sentry.uptime.consumers.results_consumer.metrics") as metrics,
            mock.patch(
                "sentry.uptime.consumers.results_consumer.TOTAL_PROVIDERS_TO_INCLUDE_AS_TAGS",
                new=1,
            ),
        ):
            self.send_result(
                self.create_uptime_result(
                    subscription.subscription_id,
                    scheduled_check_time=datetime.now() - timedelta(minutes=5),
                )
            )
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
                            "host_provider": "test_provider",
                        },
                        sample_rate=1.0,
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
                ]
            )

    @mock.patch("sentry.uptime.consumers.eap_producer._eap_items_producer.produce")
    def test_produces_snuba_uptime_results(self, mock_produce: MagicMock) -> None:
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

        assert mock_produce.call_args.args[0].name == "snuba-items"

        trace_item = self.decode_trace_item(mock_produce.call_args.args[1].value)
        assert trace_item.organization_id == self.project.organization_id
        assert trace_item.project_id == self.project.id
        assert trace_item.attributes["incident_status"].int_value == 0
        assert trace_item.retention_days == 90

    @mock.patch("sentry.uptime.consumers.eap_producer._eap_items_producer.produce")
    def test_produces_snuba_uptime_results_in_incident(self, mock_produce: MagicMock) -> None:
        """
        Validates that the consumer produces a message to Snuba's Kafka topic for uptime check results
        """
        self.detector.config.update({"downtime_threshold": 1, "recovery_threshold": 1})
        self.detector.save()
        result = self.create_uptime_result(
            self.subscription.subscription_id,
            status=CHECKSTATUS_FAILURE,
            scheduled_check_time=datetime.now() - timedelta(minutes=5),
        )
        self.send_result(result)
        mock_produce.assert_called_once()

        assert mock_produce.call_args.args[0].name == "snuba-items"

        trace_item = self.decode_trace_item(mock_produce.call_args.args[1].value)
        assert trace_item.attributes["incident_status"].int_value == 1

    @mock.patch("sentry.uptime.consumers.eap_producer._eap_items_producer.produce")
    def test_produces_eap_uptime_results(self, mock_produce: MagicMock) -> None:
        """
        Validates that the consumer produces TraceItems to EAP's Kafka topic for uptime check results
        """
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

    def test_check_and_update_regions(self) -> None:
        sub = self.create_uptime_subscription(
            subscription_id=uuid.UUID(int=5).hex,
            region_slugs=["region1"],
        )
        self.create_uptime_detector(uptime_subscription=sub)
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

    def test_check_and_update_regions_active_shadow(self) -> None:
        sub = self.create_uptime_subscription(
            subscription_id=uuid.UUID(int=5).hex,
            region_slugs=["region1", "region2"],
        )
        self.create_uptime_detector(uptime_subscription=sub)
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

    def test_check_and_update_regions_larger_interval(self) -> None:
        # Create subscription with only one region
        hour_sub = self.create_uptime_subscription(
            subscription_id=uuid.UUID(int=4).hex,
            region_slugs=["region1"],
            interval_seconds=UptimeSubscription.IntervalSeconds.ONE_HOUR,
        )
        self.create_uptime_detector(uptime_subscription=hour_sub)
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
        self.create_uptime_detector(uptime_subscription=five_min_sub)
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
        self.create_uptime_detector(uptime_subscription=five_min_sub)
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

    def test_check_and_update_regions_removes_disabled(self) -> None:
        sub = self.create_uptime_subscription(
            subscription_id=uuid.UUID(int=5).hex,
            region_slugs=["region1", "region2"],
        )
        self.create_uptime_detector(uptime_subscription=sub)
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

    def test_out_of_order_result_queued(self):
        """Out-of-order results should be queued when feature flag is enabled."""
        cluster = get_cluster()
        base_time = datetime.now()

        # Process first result at 4:00
        result1 = self.create_uptime_result(
            self.subscription.subscription_id,
            scheduled_check_time=base_time,
        )
        with self.feature("organizations:uptime-backlog-retry"):
            self.send_result(result1)

        # Send result at 4:10. Should be queued because we expected a result at 4:05
        result2 = self.create_uptime_result(
            self.subscription.subscription_id,
            scheduled_check_time=base_time + timedelta(minutes=10),
        )

        with (
            self.feature("organizations:uptime-backlog-retry"),
            mock.patch("sentry.uptime.consumers.tasks.process_uptime_backlog") as mock_task,
        ):
            self.send_result(result2)

            backlog_key = build_backlog_key(str(self.subscription.id))
            assert cluster.zcard(backlog_key) == 1
            mock_task.apply_async.assert_called_once()
            call_kwargs = mock_task.apply_async.call_args[1]
            assert call_kwargs["args"] == [str(self.subscription.id)]
            assert call_kwargs["countdown"] == 10
            assert call_kwargs["kwargs"]["attempt"] == 1

    def test_feature_flag_disabled_processes_normally(self):
        """When feature flag is disabled, results should process normally without queueing."""
        cluster = get_cluster()
        base_time = datetime.now()

        result1 = self.create_uptime_result(
            self.subscription.subscription_id,
            scheduled_check_time=base_time,
        )
        self.send_result(result1)

        result2 = self.create_uptime_result(
            self.subscription.subscription_id,
            scheduled_check_time=base_time + timedelta(minutes=10),
        )

        self.send_result(result2)

        backlog_key = build_backlog_key(str(self.subscription.id))
        assert cluster.zcard(backlog_key) == 0

    def test_task_scheduling_deduplication(self):
        """Multiple out-of-order results shouldn't schedule duplicate tasks."""
        cluster = get_cluster()
        base_time = datetime.now()

        result1 = self.create_uptime_result(
            self.subscription.subscription_id,
            scheduled_check_time=base_time,
        )
        with self.feature("organizations:uptime-backlog-retry"):
            self.send_result(result1)

        result2 = self.create_uptime_result(
            self.subscription.subscription_id,
            scheduled_check_time=base_time + timedelta(minutes=10),
        )
        result3 = self.create_uptime_result(
            self.subscription.subscription_id,
            scheduled_check_time=base_time + timedelta(minutes=15),
        )

        with (
            self.feature("organizations:uptime-backlog-retry"),
            mock.patch("sentry.uptime.consumers.tasks.process_uptime_backlog") as mock_task,
        ):
            self.send_result(result2)
            self.send_result(result3)

            # Verify task was only scheduled once
            assert mock_task.apply_async.call_count == 1

            # Verify both results were queued
            backlog_key = build_backlog_key(str(self.subscription.id))
            assert cluster.zcard(backlog_key) == 2


@thread_leak_allowlist(reason="uptime consumers", issue=97045)
class ProcessResultSerialTest(ProcessResultTest):
    strategy_processing_mode = "serial"

    def test_parallel(self) -> None:
        """
        Validates that the consumer in parallel mode correctly groups check-ins
        into groups by their monitor slug / environment
        """

        factory = UptimeResultsStrategyFactory(
            consumer_group="test",
            mode="batched-parallel",
            max_batch_size=3,
            max_workers=1,
        )
        consumer = factory.create_with_partitions(mock.Mock(), {self.partition: 0})
        with mock.patch.object(type(factory.result_processor), "__call__") as mock_processor_call:
            subscription_2 = self.create_uptime_subscription(
                subscription_id=uuid.uuid4().hex, interval_seconds=300, url="http://santry.io"
            )
            self.create_uptime_detector(uptime_subscription=subscription_2)

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
    def test_parallel_grouping(self, mock_process_group: MagicMock) -> None:
        """
        Validates that the consumer in parallel mode correctly groups check-ins
        into groups by their monitor slug / environment
        """

        factory = UptimeResultsStrategyFactory(
            consumer_group="test",
            mode="batched-parallel",
            max_batch_size=3,
            max_workers=1,
        )
        consumer = factory.create_with_partitions(mock.Mock(), {self.partition: 0})
        subscription_2 = self.create_uptime_subscription(
            subscription_id=uuid.uuid4().hex, interval_seconds=300, url="http://santry.io"
        )
        self.create_uptime_detector(uptime_subscription=subscription_2)

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


@thread_leak_allowlist(reason="uptime consumers", issue=97045)
class ProcessResultParallelTest(ProcessResultTest):
    strategy_processing_mode = "parallel"
