import copy
import math
from datetime import timedelta
from functools import cached_property
from unittest.mock import MagicMock, call, patch
from uuid import uuid4

import orjson
import pytest
from django.utils import timezone
from urllib3.response import HTTPResponse

from sentry.constants import ObjectStatus
from sentry.incidents.subscription_processor import SubscriptionProcessor
from sentry.incidents.utils.types import QuerySubscriptionUpdate
from sentry.seer.anomaly_detection.types import (
    AnomalyDetectionSeasonality,
    AnomalyDetectionSensitivity,
    AnomalyDetectionThresholdType,
    AnomalyType,
    DetectAnomaliesResponse,
)
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.utils import resolve_tag_key
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.testutils.cases import BaseMetricsTestCase
from sentry.testutils.factories import DEFAULT_EVENT_DATA
from sentry.testutils.helpers.features import with_feature
from sentry.workflow_engine.models.data_condition import Condition, DataCondition
from sentry.workflow_engine.models.detector import Detector
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.incidents.subscription_processor.test_subscription_processor_base import (
    ProcessUpdateBaseClass,
)

EMPTY = object()
pytestmark = [pytest.mark.sentry_metrics]


class ProcessUpdateTest(ProcessUpdateBaseClass):
    """
    Test early return scenarios and simple cases.
    """

    def test_simple(self) -> None:
        """
        Verify that an alert can trigger.
        """
        self.send_update(self.critical_threshold + 1)
        assert self.get_detector_state(self.metric_detector) == DetectorPriorityLevel.HIGH

    @patch("sentry.incidents.subscription_processor.metrics")
    def test_missing_project(self, mock_metrics: MagicMock) -> None:
        metrics_call = "incidents.alert_rules.ignore_deleted_project"

        self.sub.project.update(status=ObjectStatus.PENDING_DELETION)
        self.sub.project.save()

        assert self.send_update(self.critical_threshold + 1) is False
        mock_metrics.incr.assert_any_call(metrics_call)

        self.sub.project.delete()
        assert self.send_update(self.critical_threshold + 1) is False

    @patch("sentry.incidents.subscription_processor.metrics")
    def test_has_downgraded_incidents(self, mock_metrics: MagicMock) -> None:
        message = self.build_subscription_update(
            self.sub, value=self.critical_threshold + 1, time_delta=timedelta()
        )

        with self.capture_on_commit_callbacks(execute=True):
            assert SubscriptionProcessor.process(self.sub, message) is False
            mock_metrics.incr.assert_has_calls(
                [call("incidents.alert_rules.ignore_update_missing_incidents")]
            )

    @patch("sentry.incidents.subscription_processor.metrics")
    def test_has_downgraded_incidents_performance(self, mock_metrics: MagicMock) -> None:
        snuba_query = self.get_snuba_query(self.detector)
        snuba_query.update(time_window=15 * 60, dataset=Dataset.Transactions.value)
        snuba_query.save()

        message = self.build_subscription_update(
            self.sub, value=self.critical_threshold + 1, time_delta=timedelta()
        )

        with self.capture_on_commit_callbacks(execute=True):
            assert SubscriptionProcessor.process(self.sub, message) is False
            mock_metrics.incr.assert_has_calls(
                [call("incidents.alert_rules.ignore_update_missing_incidents_performance")]
            )

    @patch("sentry.incidents.subscription_processor.metrics")
    def test_invalid_aggregation_value(self, mock_metrics: MagicMock) -> None:
        self.send_update(math.nan)
        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.OK
        mock_metrics.incr.assert_has_calls(
            [
                call("incidents.alert_rules.skipping_update_invalid_aggregation_value"),
            ]
        )

    @patch("sentry.incidents.subscription_processor.metrics")
    def test_has_downgraded_on_demand(self, mock_metrics: MagicMock) -> None:
        snuba_query = self.get_snuba_query(self.detector)
        snuba_query.update(time_window=15 * 60, dataset=Dataset.PerformanceMetrics.value)
        snuba_query.save()

        message = self.build_subscription_update(
            self.sub, value=self.critical_threshold + 1, time_delta=timedelta()
        )

        with self.capture_on_commit_callbacks(execute=True):
            assert SubscriptionProcessor.process(self.sub, message) is False
            mock_metrics.incr.assert_has_calls(
                [call("incidents.alert_rules.ignore_update_missing_on_demand")]
            )

    @patch("sentry.incidents.subscription_processor.metrics")
    def test_skip_already_processed_update(self, mock_metrics: MagicMock) -> None:
        assert self.send_update(value=self.critical_threshold + 1) is True
        mock_metrics.incr.reset_mock()
        assert self.send_update(value=self.critical_threshold + 1) is False

        mock_metrics.incr.assert_any_call("incidents.alert_rules.skipping_already_processed_update")
        mock_metrics.incr.reset_mock()
        assert (
            self.send_update(value=self.critical_threshold + 1, time_delta=timedelta(hours=1))
            is True
        )

        mock_metrics.incr.assert_any_call("incidents.alert_rules.process_update.start")

    def test_resolve(self) -> None:
        self.send_update(self.critical_threshold + 1, timedelta(minutes=-2))
        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.HIGH

        self.send_update(self.resolve_threshold - 1, timedelta(minutes=-1))
        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.OK

    def test_resolve_percent_boundary(self) -> None:
        self.update_threshold(self.detector, DetectorPriorityLevel.HIGH, 0.5)
        self.update_threshold(self.detector, DetectorPriorityLevel.OK, 0.5)
        self.send_update(self.critical_threshold + 0.1, timedelta(minutes=-2))
        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.HIGH

        self.send_update(self.resolve_threshold, timedelta(minutes=-1))
        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.OK

    def test_reversed(self) -> None:
        """
        Test that resolutions work when the threshold is reversed.
        """
        DataCondition.objects.filter(
            condition_group=self.detector.workflow_condition_group
        ).delete()
        self.set_up_data_conditions(self.detector, Condition.LESS, 100, None, 100)
        self.send_update(self.critical_threshold - 1, timedelta(minutes=-2))
        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.HIGH

        self.send_update(self.resolve_threshold, timedelta(minutes=-1))
        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.OK

    def test_multiple_triggers(self) -> None:
        DataCondition.objects.filter(
            condition_group=self.detector.workflow_condition_group
        ).delete()
        self.set_up_data_conditions(self.detector, Condition.GREATER, 100, 50, 50)

        self.send_update(self.warning_threshold + 1, timedelta(minutes=-5))
        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.MEDIUM

        self.send_update(self.critical_threshold + 1, timedelta(minutes=-4))
        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.HIGH

        self.send_update(self.critical_threshold - 1, timedelta(minutes=-3))
        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.MEDIUM

        self.send_update(self.warning_threshold - 1, timedelta(minutes=-2))
        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.OK

    def test_multiple_triggers_reversed(self) -> None:
        DataCondition.objects.filter(
            condition_group=self.detector.workflow_condition_group
        ).delete()
        self.set_up_data_conditions(self.detector, Condition.LESS, 50, 100, 100)

        self.send_update(self.warning_threshold - 1, timedelta(minutes=-5))
        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.MEDIUM

        self.send_update(self.critical_threshold - 1, timedelta(minutes=-4))
        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.HIGH

        self.send_update(self.critical_threshold + 1, timedelta(minutes=-3))
        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.MEDIUM

        self.send_update(self.warning_threshold + 1, timedelta(minutes=-2))
        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.OK

    # TODO: the subscription processor has a 10 minute cooldown period for creating new incidents
    # We probably need similar logic within workflow engine.


class ProcessUpdateComparisonAlertTest(ProcessUpdateBaseClass):
    @cached_property
    def comparison_detector_above(self):
        self.detector.config.update({"comparison_delta": 60 * 60})
        self.detector.save()
        self.update_threshold(self.detector, DetectorPriorityLevel.HIGH, 150)
        self.update_threshold(self.detector, DetectorPriorityLevel.OK, 150)
        self.snuba_query = self.get_snuba_query(self.detector)
        self.snuba_query.update(time_window=60 * 60)
        return self.detector

    @cached_property
    def comparison_detector_below(self):
        self.detector.config.update({"comparison_delta": 60 * 60})
        self.detector.save()
        DataCondition.objects.filter(
            condition_group=self.detector.workflow_condition_group
        ).delete()
        self.set_up_data_conditions(self.detector, Condition.LESS, 50, None, 50)
        snuba_query = self.get_snuba_query(self.detector)
        snuba_query.update(time_window=60 * 60)
        return self.detector

    @patch("sentry.incidents.utils.process_update_helpers.metrics")
    def test_comparison_alert_above(self, helper_metrics):
        detector = self.comparison_detector_above
        comparison_delta = timedelta(seconds=detector.config["comparison_delta"])
        self.send_update(self.critical_threshold + 1, timedelta(minutes=-10))

        # Shouldn't trigger, since there should be no data in the comparison period
        assert self.get_detector_state(detector) == DetectorPriorityLevel.OK
        helper_metrics.incr.assert_has_calls(
            [
                call("incidents.alert_rules.skipping_update_comparison_value_invalid"),
            ]
        )
        self.metrics.incr.assert_has_calls(
            [
                call("incidents.alert_rules.skipping_update_invalid_aggregation_value"),
            ]
        )
        comparison_date = timezone.now() - comparison_delta

        for i in range(4):
            self.store_event(
                data={
                    "timestamp": (comparison_date - timedelta(minutes=30 + i)).isoformat(),
                    "environment": self.environment.name,
                },
                project_id=self.project.id,
            )
        self.metrics.incr.reset_mock()
        self.send_update(2, timedelta(minutes=-9))
        # Shouldn't trigger, since there are 4 events in the comparison period, and 2/4 == 50%
        assert self.get_detector_state(detector) == DetectorPriorityLevel.OK

        self.send_update(4, timedelta(minutes=-8))
        # Shouldn't trigger, since there are 4 events in the comparison period, and 4/4 == 100%
        assert self.get_detector_state(detector) == DetectorPriorityLevel.OK

        self.send_update(6, timedelta(minutes=-7))
        # Shouldn't trigger: 6/4 == 150%, but we want > 150%
        assert self.get_detector_state(detector) == DetectorPriorityLevel.OK

        self.send_update(7, timedelta(minutes=-6))
        # Should trigger: 7/4 == 175% > 150%
        assert self.get_detector_state(detector) == DetectorPriorityLevel.HIGH

        # Check that we successfully resolve
        self.send_update(6, timedelta(minutes=-5))
        assert self.get_detector_state(detector) == DetectorPriorityLevel.OK

    @patch("sentry.incidents.utils.process_update_helpers.metrics")
    def test_comparison_alert_below(self, helper_metrics):
        detector = self.comparison_detector_below
        comparison_delta = timedelta(seconds=detector.config["comparison_delta"])
        self.send_update(self.critical_threshold - 1, timedelta(minutes=-10))

        # Shouldn't trigger, since there should be no data in the comparison period
        assert self.get_detector_state(detector) == DetectorPriorityLevel.OK
        helper_metrics.incr.assert_has_calls(
            [
                call("incidents.alert_rules.skipping_update_comparison_value_invalid"),
            ]
        )
        self.metrics.incr.assert_has_calls(
            [
                call("incidents.alert_rules.skipping_update_invalid_aggregation_value"),
            ]
        )
        comparison_date = timezone.now() - comparison_delta

        for i in range(4):
            self.store_event(
                data={
                    "timestamp": (comparison_date - timedelta(minutes=30 + i)).isoformat(),
                    "environment": self.environment.name,
                },
                project_id=self.project.id,
            )

        self.metrics.incr.reset_mock()
        self.send_update(6, timedelta(minutes=-9))
        # Shouldn't trigger, since there are 4 events in the comparison period, and 6/4 == 150%
        assert self.get_detector_state(detector) == DetectorPriorityLevel.OK

        self.send_update(4, timedelta(minutes=-8))
        # Shouldn't trigger, since there are 4 events in the comparison period, and 4/4 == 100%
        assert self.get_detector_state(detector) == DetectorPriorityLevel.OK

        self.send_update(2, timedelta(minutes=-7))
        # Shouldn't trigger: 2/4 == 50%, but we want < 50%
        assert self.get_detector_state(detector) == DetectorPriorityLevel.OK

        self.send_update(1, timedelta(minutes=-6))
        # Should trigger: 1/4 == 25% < 50%
        assert self.get_detector_state(detector) == DetectorPriorityLevel.HIGH

        # Check that we successfully resolve
        self.send_update(2, timedelta(minutes=-5))
        assert self.get_detector_state(detector) == DetectorPriorityLevel.OK

    @patch("sentry.incidents.utils.process_update_helpers.metrics")
    def test_is_unresolved_comparison_query(self, helper_metrics):
        """
        Test that uses the ErrorsQueryBuilder (because of the specific query)
        """
        detector = self.comparison_detector_above
        comparison_delta = timedelta(seconds=detector.config["comparison_delta"])
        snuba_query = self.get_snuba_query(detector)
        snuba_query.update(query="(event.type:error) AND (is:unresolved)")

        self.send_update(self.critical_threshold + 1, timedelta(minutes=-10), subscription=self.sub)
        helper_metrics.incr.assert_has_calls(
            [
                call("incidents.alert_rules.skipping_update_comparison_value_invalid"),
            ]
        )
        self.metrics.incr.assert_has_calls(
            [
                call("incidents.alert_rules.skipping_update_invalid_aggregation_value"),
            ]
        )
        comparison_date = timezone.now() - comparison_delta

        for i in range(4):
            data = {
                "timestamp": (comparison_date - timedelta(minutes=30 + i)).isoformat(),
                "environment": self.environment.name,
                "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
                "fingerprint": ["group2"],
                "level": "error",
                "exception": {
                    "values": [
                        {
                            "type": "IntegrationError",
                            "value": "Identity not found.",
                        }
                    ]
                },
            }
            self.store_event(
                data=data,
                project_id=self.project.id,
            )

        self.metrics.incr.reset_mock()
        self.send_update(2, timedelta(minutes=-9))
        # Shouldn't trigger, since there are 4 events in the comparison period, and 2/4 == 50%
        assert self.get_detector_state(detector) == DetectorPriorityLevel.OK

        self.send_update(4, timedelta(minutes=-8))
        # Shouldn't trigger, since there are 4 events in the comparison period, and 4/4 == 100%
        assert self.get_detector_state(detector) == DetectorPriorityLevel.OK

        self.send_update(6, timedelta(minutes=-7))
        # Shouldn't trigger: 6/4 == 150%, but we want > 150%
        assert self.get_detector_state(detector) == DetectorPriorityLevel.OK

        self.send_update(7, timedelta(minutes=-6))
        # Should trigger: 7/4 == 175% > 150%
        assert self.get_detector_state(detector) == DetectorPriorityLevel.HIGH

        # Check that we successfully resolve
        self.send_update(6, timedelta(minutes=-5))
        assert self.get_detector_state(detector) == DetectorPriorityLevel.OK

    @patch("sentry.incidents.utils.process_update_helpers.metrics")
    def test_is_unresolved_different_aggregate(self, helper_metrics):
        detector = self.comparison_detector_above
        comparison_delta = timedelta(seconds=detector.config["comparison_delta"])
        snuba_query = self.get_snuba_query(detector)
        snuba_query.update(aggregate="count_unique(tags[sentry:user])")

        self.send_update(self.critical_threshold + 1, timedelta(minutes=-10), subscription=self.sub)
        helper_metrics.incr.assert_has_calls(
            [
                call("incidents.alert_rules.skipping_update_comparison_value_invalid"),
            ]
        )
        self.metrics.incr.assert_has_calls(
            [
                call("incidents.alert_rules.skipping_update_invalid_aggregation_value"),
            ]
        )
        comparison_date = timezone.now() - comparison_delta

        for i in range(4):
            self.store_event(
                data={
                    "timestamp": (comparison_date - timedelta(minutes=30 + i)).isoformat(),
                    "environment": self.environment.name,
                    "tags": {"sentry:user": i},
                },
                project_id=self.project.id,
            )

        self.metrics.incr.reset_mock()
        self.send_update(2, timedelta(minutes=-9))
        # Shouldn't trigger, since there are 4 events in the comparison period, and 2/4 == 50%
        assert self.get_detector_state(detector) == DetectorPriorityLevel.OK

        self.send_update(4, timedelta(minutes=-8))
        # Shouldn't trigger, since there are 4 events in the comparison period, and 4/4 == 100%
        assert self.get_detector_state(detector) == DetectorPriorityLevel.OK

        self.send_update(6, timedelta(minutes=-7))
        # Shouldn't trigger: 6/4 == 150%, but we want > 150%
        assert self.get_detector_state(detector) == DetectorPriorityLevel.OK

        self.send_update(7, timedelta(minutes=-6))
        # Should trigger: 7/4 == 175% > 150%
        assert self.get_detector_state(detector) == DetectorPriorityLevel.HIGH

        # Check that we successfully resolve
        self.send_update(6, timedelta(minutes=-5))
        assert self.get_detector_state(detector) == DetectorPriorityLevel.OK


class ProcessUpdateUpsampledCountTest(ProcessUpdateBaseClass):
    """Test that upsampled_count() aggregate works correctly with sample weight data"""

    @cached_property
    def upsampled_detector(self) -> Detector:
        """Create a detector that uses upsampled_count() aggregate function"""
        detector = self.metric_detector
        snuba_query = self.get_snuba_query(detector)
        snuba_query.update(
            time_window=3600,
            aggregate="upsampled_count()",
            resolution=60,
        )
        snuba_query.save()

        DataCondition.objects.filter(condition_group=detector.workflow_condition_group).delete()
        self.set_up_data_conditions(
            detector=detector,
            threshold_type=Condition.GREATER,
            critical_threshold=20,
            resolve_threshold=10,
        )
        return detector

    def setUp(self) -> None:
        super().setUp()
        self.detector = self.upsampled_detector

    def build_upsampled_subscription_update(
        self,
        subscription: QuerySubscription,
        upsampled_count: float = 1.0,
        time_delta: timedelta | None = None,
    ) -> QuerySubscriptionUpdate:
        """Build a subscription update that simulates upsampled_count() query results"""
        if time_delta is not None:
            timestamp = timezone.now() + time_delta
        else:
            timestamp = timezone.now()
        timestamp = timestamp.replace(microsecond=0)

        # Create subscription update with the aggregation value
        subscription_update: QuerySubscriptionUpdate = {
            "subscription_id": (
                str(subscription.subscription_id) if subscription else str(uuid4().hex)
            ),
            "values": {"data": [{"upsampled_count": upsampled_count}]},
            "timestamp": timestamp,
            "entity": EntityKey.Events.value,
        }
        return subscription_update

    def send_upsampled_update(
        self, upsampled_count: float, time_delta: timedelta | None = None
    ) -> None:
        """Send a subscription update simulating upsampled_count() query results"""
        if time_delta is None:
            time_delta = timedelta()

        message = self.build_upsampled_subscription_update(
            self.sub, upsampled_count=upsampled_count, time_delta=time_delta
        )
        with (
            self.feature("organizations:incidents"),
            self.feature("organizations:performance-view"),
        ):
            SubscriptionProcessor.process(self.sub, message)

    def test_upsampled_count_no_detector_below_threshold(self) -> None:
        """Test that the detector is not triggered when upsampled count is below threshold"""
        # Send update with upsampled_count below threshold (1 < 20)
        self.send_upsampled_update(upsampled_count=1.0)

        # Verify detector was not triggered (1 < 20 threshold)
        assert self.get_detector_state(self.upsampled_detector) == DetectorPriorityLevel.OK

    def test_upsampled_count_detector_above_threshold(self) -> None:
        """Test that detector is triggered when upsampled count exceeds threshold"""
        # Send update with upsampled_count above threshold (30 > 20)
        self.send_upsampled_update(upsampled_count=30.0)

        # Verify detector was triggered (30 > 20 threshold)
        assert self.get_detector_state(self.upsampled_detector) == DetectorPriorityLevel.HIGH

    def test_upsampled_count_detector_and_resolve(self) -> None:
        """Test detector triggering and resolving with upsampled count"""
        # First, trigger the detector with high upsampled_count
        self.send_upsampled_update(upsampled_count=30.0)
        assert self.get_detector_state(self.upsampled_detector) == DetectorPriorityLevel.HIGH

        # Then resolve it with low upsampled_count (below resolve threshold of 10)
        self.send_upsampled_update(upsampled_count=5.0, time_delta=timedelta(minutes=1))
        assert self.get_detector_state(self.upsampled_detector) == DetectorPriorityLevel.OK


class MetricsCrashRateDetectorProcessUpdateTest(ProcessUpdateBaseClass, BaseMetricsTestCase):
    @pytest.fixture(autouse=True)
    def _setup_metrics_patcher(self):
        with patch("sentry.snuba.entity_subscription.metrics") as self.entity_subscription_metrics:
            yield

    @cached_property
    def crash_rate_detector(self):
        detector = self.metric_detector
        DataCondition.objects.filter(condition_group=detector.workflow_condition_group).delete()
        self.set_up_data_conditions(
            detector=detector,
            threshold_type=Condition.LESS,
            critical_threshold=80,
            warning_threshold=90,
        )
        snuba_query = self.get_snuba_query(detector)
        snuba_query.update(
            type=SnubaQuery.Type.CRASH_RATE.value,
            time_window=3600,
            dataset=Dataset.Metrics.value,
            aggregate="percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
            resolution=60,
        )
        snuba_query.save()
        return detector

    def setUp(self) -> None:
        super().setUp()
        self.detector = self.crash_rate_detector

        for status in ["exited", "crashed"]:
            self.store_session(
                self.build_session(
                    status=status,
                )
            )

    def send_crash_rate_detector_update(self, value, subscription, time_delta=None, count=EMPTY):
        if time_delta is None:
            time_delta = timedelta()

        if time_delta is not None:
            timestamp = timezone.now() + time_delta
        else:
            timestamp = timezone.now()
        timestamp = timestamp.replace(microsecond=0)

        with (
            self.feature(["organizations:incidents", "organizations:performance-view"]),
            self.capture_on_commit_callbacks(execute=True),
        ):
            if value is None:
                numerator, denominator = 0, 0
            else:
                if count is EMPTY:
                    numerator, denominator = value.as_integer_ratio()
                else:
                    denominator = count
                    numerator = int(value * denominator)
            SubscriptionProcessor.process(
                subscription,
                {
                    "entity": "entity",
                    "subscription_id": (
                        subscription.subscription_id if subscription else uuid4().hex
                    ),
                    "values": {
                        "data": [
                            {
                                "project_id": 8,
                                "count": denominator,
                                "crashed": numerator,
                            },
                        ]
                    },
                    "timestamp": timestamp,
                },
            )

    def test_crash_rate_detector_for_sessions_with_auto_resolve_critical(self) -> None:
        """
        Test that ensures that a detector is triggered when `crash_free_percentage` falls
        below the critical threshold and then is resolved once `crash_free_percentage` goes above
        the threshold (when no resolve_threshold is set)
        """

        # Send critical Update
        update_value = (1 - self.critical_threshold / 100) + 0.05
        self.send_crash_rate_detector_update(
            value=update_value,
            time_delta=timedelta(minutes=-2),
            subscription=self.sub,
        )
        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.HIGH

        # Send resolve update
        update_value = (1 - self.warning_threshold / 100) - 0.05
        self.send_crash_rate_detector_update(
            value=update_value,
            time_delta=timedelta(minutes=-1),
            subscription=self.sub,
        )
        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.OK

    @with_feature("organizations:anomaly-detection-alerts")
    @patch(
        "sentry.seer.anomaly_detection.get_anomaly_data.SEER_ANOMALY_DETECTION_CONNECTION_POOL.urlopen"
    )
    def test_dynamic_crash_rate_detector_for_sessions_with_auto_resolve_critical(
        self, mock_seer_request
    ):
        """
        Test that ensures that a dynamic critical monitor is triggered when `crash_free_percentage` falls
        below the critical threshold and then is resolved once `crash_free_percentage` goes above
        the threshold (when no resolve_threshold is set)
        """

        # update the detector to be dynamic
        detector = self.crash_rate_detector
        detector.update(config={"detection_type": "dynamic", "comparison_delta": None})
        detector.save()

        critical_detector_trigger = DataCondition.objects.get(
            condition_group=detector.workflow_condition_group,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        critical_detector_trigger.update(
            type=Condition.ANOMALY_DETECTION,
            comparison={
                "sensitivity": AnomalyDetectionSensitivity.MEDIUM,
                "seasonality": AnomalyDetectionSeasonality.AUTO,
                "threshold_type": AnomalyDetectionThresholdType.ABOVE_AND_BELOW,
            },
        )
        critical_detector_trigger.save()
        snuba_query = self.get_snuba_query(detector)
        snuba_query.update(time_window=15 * 60)
        snuba_query.save()

        update_value = 1 - 10 / 100
        # send critical update
        seer_return_value: DetectAnomaliesResponse = {
            "success": True,
            "timeseries": [
                {
                    "anomaly": {
                        "anomaly_score": 0.7,
                        "anomaly_type": AnomalyType.HIGH_CONFIDENCE.value,
                    },
                    "timestamp": 1,
                    "value": update_value,
                }
            ],
        }

        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value), status=200)
        self.send_crash_rate_detector_update(
            value=update_value,
            time_delta=timedelta(minutes=-2),
            subscription=self.sub,
        )
        assert mock_seer_request.call_count == 1
        assert self.get_detector_state(detector) == DetectorPriorityLevel.HIGH

        # resolve the detector
        seer_return_value2: DetectAnomaliesResponse = {
            "success": True,
            "timeseries": [
                {
                    "anomaly": {
                        "anomaly_score": 0.2,
                        "anomaly_type": AnomalyType.NONE.value,
                    },
                    "timestamp": 1,
                    "value": 5,
                }
            ],
        }
        mock_seer_request.return_value = HTTPResponse(orjson.dumps(seer_return_value2), status=200)
        update_value = (1 - 0 / 100) - 0.05
        self.send_crash_rate_detector_update(
            value=update_value,
            time_delta=timedelta(minutes=-1),
            subscription=self.sub,
        )
        assert mock_seer_request.call_count == 2
        assert self.get_detector_state(detector) == DetectorPriorityLevel.OK

    def test_crash_rate_detector_for_sessions_with_auto_resolve_warning(self) -> None:
        """
        Test that ensures that a detector is triggered when `crash_free_percentage` falls
        below the warning data condition threshold and then is resolved once `crash_free_percentage` goes above
        the threshold (when no resolve_threshold is set)
        """

        # Send warning update
        update_value = (1 - self.warning_threshold / 100) + 0.05
        self.send_crash_rate_detector_update(
            value=update_value,
            time_delta=timedelta(minutes=-3),
            subscription=self.sub,
        )

        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.MEDIUM

        update_value = (1 - self.warning_threshold / 100) - 0.05
        self.send_crash_rate_detector_update(
            value=update_value,
            time_delta=timedelta(minutes=-1),
            subscription=self.sub,
        )
        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.OK

    def test_crash_rate_detector_for_sessions_with_critical_warning_then_resolved(self) -> None:
        """
        Test the behavior going from critical status to warning status to resolved
        for crash rate monitors
        """

        # Send Critical Update
        update_value = (1 - self.critical_threshold / 100) + 0.05
        self.send_crash_rate_detector_update(
            value=update_value,
            time_delta=timedelta(minutes=-10),
            subscription=self.sub,
        )
        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.HIGH

        # Send Warning Update
        update_value = (1 - self.warning_threshold / 100) + 0.05
        self.send_crash_rate_detector_update(
            value=update_value,
            time_delta=timedelta(minutes=-3),
            subscription=self.sub,
        )
        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.MEDIUM

        # Send update higher than warning threshold
        update_value = (1 - self.warning_threshold / 100) - 0.05
        self.send_crash_rate_detector_update(
            value=update_value,
            time_delta=timedelta(minutes=-1),
            subscription=self.sub,
        )
        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.OK

    def test_crash_rate_detector_for_sessions_with_triggers_lower_than_resolve_threshold(
        self,
    ) -> None:
        """
        Test that ensures that when `crash_rate_percentage` goes above the warning threshold but
        lower than the resolve threshold, detector is not resolved
        """
        self.update_threshold(self.detector, DetectorPriorityLevel.OK, 95)

        # Send Critical Update
        update_value = (1 - self.critical_threshold / 100) + 0.05
        self.send_crash_rate_detector_update(
            value=update_value,
            time_delta=timedelta(minutes=-10),
            subscription=self.sub,
        )
        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.HIGH

        # Send Warning Update
        update_value = (1 - self.warning_threshold / 100) + 0.05
        self.send_crash_rate_detector_update(
            value=update_value,
            time_delta=timedelta(minutes=-3),
            subscription=self.sub,
        )
        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.MEDIUM

        # Send update higher than warning threshold but lower than resolve threshold
        update_value = (1 - self.warning_threshold / 100) - 0.04

        self.send_crash_rate_detector_update(
            value=update_value,
            time_delta=timedelta(minutes=-1),
            subscription=self.sub,
        )
        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.MEDIUM

    @patch("sentry.incidents.utils.process_update_helpers.metrics")
    def test_crash_rate_detector_for_sessions_with_no_sessions_data(
        self, helper_metrics: MagicMock
    ) -> None:
        """
        Test that ensures we skip the crash rate detector processing if we have no sessions data
        """

        self.send_crash_rate_detector_update(
            value=None,
            subscription=self.sub,
        )
        helper_metrics.incr.assert_has_calls(
            [
                call("incidents.alert_rules.ignore_update_no_session_data"),
            ]
        )
        self.metrics.incr.assert_has_calls(
            [
                call("incidents.alert_rules.skipping_update_invalid_aggregation_value"),
            ]
        )

    @patch("sentry.incidents.utils.process_update_helpers.CRASH_RATE_ALERT_MINIMUM_THRESHOLD", 30)
    @patch("sentry.incidents.utils.process_update_helpers.metrics")
    def test_crash_rate_detector_when_session_count_is_lower_than_minimum_threshold(
        self, helper_metrics
    ):
        # Send Critical Update
        update_value = (1 - self.critical_threshold / 100) + 0.05
        self.send_crash_rate_detector_update(
            value=update_value,
            count=10,
            time_delta=timedelta(minutes=-10),
            subscription=self.sub,
        )
        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.OK
        helper_metrics.incr.assert_has_calls(
            [
                call("incidents.alert_rules.ignore_update_count_lower_than_min_threshold"),
            ]
        )
        self.metrics.incr.assert_has_calls(
            [
                call("incidents.alert_rules.skipping_update_invalid_aggregation_value"),
            ]
        )

    @patch("sentry.incidents.utils.process_update_helpers.CRASH_RATE_ALERT_MINIMUM_THRESHOLD", 30)
    def test_crash_rate_detector_when_session_count_is_higher_than_minimum_threshold(self) -> None:

        # Send Critical Update
        update_value = (1 - self.critical_threshold / 100) + 0.05
        self.send_crash_rate_detector_update(
            value=update_value,
            count=31,
            time_delta=timedelta(minutes=-10),
            subscription=self.sub,
        )
        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.HIGH

    @patch("sentry.incidents.utils.process_update_helpers.metrics")
    def test_multiple_threshold_trigger_is_reset_when_no_sessions_data(
        self, helper_metrics: MagicMock
    ) -> None:

        update_value = (1 - self.critical_threshold / 100) + 0.05
        self.send_crash_rate_detector_update(
            value=update_value,
            time_delta=timedelta(minutes=-2),
            subscription=self.sub,
        )
        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.HIGH

        self.send_crash_rate_detector_update(
            value=None,
            time_delta=timedelta(minutes=-1),
            subscription=self.sub,
        )
        helper_metrics.incr.assert_has_calls(
            [
                call("incidents.alert_rules.ignore_update_no_session_data"),
            ],
        )
        self.metrics.incr.assert_has_calls(
            [
                call("incidents.alert_rules.skipping_update_invalid_aggregation_value"),
            ]
        )
        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.HIGH

    @patch("sentry.incidents.utils.process_update_helpers.CRASH_RATE_ALERT_MINIMUM_THRESHOLD", 30)
    @patch("sentry.incidents.utils.process_update_helpers.metrics")
    def test_multiple_threshold_trigger_is_reset_when_count_is_lower_than_min_threshold(
        self, helper_metrics
    ):
        update_value = (1 - self.critical_threshold / 100) + 0.05
        subscription = self.sub

        self.send_crash_rate_detector_update(
            value=update_value,
            time_delta=timedelta(minutes=-2),
            subscription=subscription,
        )
        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.HIGH

        self.send_crash_rate_detector_update(
            value=update_value,
            count=1,
            time_delta=timedelta(minutes=-1),
            subscription=subscription,
        )
        helper_metrics.incr.assert_has_calls(
            [
                call("incidents.alert_rules.ignore_update_count_lower_than_min_threshold"),
            ],
        )
        self.metrics.incr.assert_has_calls(
            [
                call("incidents.alert_rules.skipping_update_invalid_aggregation_value"),
            ],
        )
        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.HIGH

    @patch("sentry.incidents.utils.process_update_helpers.metrics")
    def test_ensure_case_when_no_metrics_index_not_found_is_handled_gracefully(
        self, helper_metrics
    ):
        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            SubscriptionProcessor.process(
                self.sub,
                {
                    "entity": "entity",
                    "subscription_id": self.sub.subscription_id,
                    "values": {
                        # 1001 is a random int that doesn't map to anything in the indexer
                        "data": [
                            {
                                resolve_tag_key(
                                    UseCaseKey.RELEASE_HEALTH,
                                    self.organization.id,
                                    "session.status",
                                ): 1001
                            }
                        ]
                    },
                    "timestamp": timezone.now(),
                },
            )
        assert self.get_detector_state(self.detector) == DetectorPriorityLevel.OK
        helper_metrics.incr.assert_has_calls(
            [
                call("incidents.alert_rules.ignore_update_no_session_data"),
            ]
        )

        self.metrics.incr.assert_has_calls(
            [
                call("incidents.alert_rules.skipping_update_invalid_aggregation_value"),
            ]
        )
