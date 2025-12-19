import copy
from datetime import timedelta
from functools import cached_property
from unittest.mock import MagicMock, call, patch
from uuid import uuid4

from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.incidents.subscription_processor import SubscriptionProcessor
from sentry.incidents.utils.types import QuerySubscriptionUpdate
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.models import QuerySubscription
from sentry.testutils.factories import DEFAULT_EVENT_DATA
from sentry.workflow_engine.models.data_condition import Condition, DataCondition
from sentry.workflow_engine.models.detector import Detector
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.incidents.subscription_processor.test_subscription_processor_base import (
    ProcessUpdateBaseClass,
)


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
        mock_metrics.incr.assert_has_calls([call(metrics_call)])

        mock_metrics.reset_mock()

        self.sub.project.delete()
        assert self.send_update(self.critical_threshold + 1) is False
        mock_metrics.incr.assert_has_calls([call(metrics_call)])

    @patch("sentry.incidents.subscription_processor.metrics")
    def test_has_downgraded_incidents(self, mock_metrics: MagicMock) -> None:
        processor = SubscriptionProcessor(self.sub)
        message = self.build_subscription_update(
            self.sub, value=self.critical_threshold + 1, time_delta=timedelta()
        )

        with self.capture_on_commit_callbacks(execute=True):
            assert processor.process_update(message) is False
            mock_metrics.incr.assert_has_calls(
                [call("incidents.alert_rules.ignore_update_missing_incidents")]
            )

    @patch("sentry.incidents.subscription_processor.metrics")
    def test_has_downgraded_incidents_performance(self, mock_metrics: MagicMock) -> None:
        snuba_query = self.get_snuba_query(self.detector)
        snuba_query.update(time_window=15 * 60, dataset=Dataset.Transactions.value)
        snuba_query.save()

        processor = SubscriptionProcessor(self.sub)
        message = self.build_subscription_update(
            self.sub, value=self.critical_threshold + 1, time_delta=timedelta()
        )

        with self.capture_on_commit_callbacks(execute=True):
            assert processor.process_update(message) is False
            mock_metrics.incr.assert_has_calls(
                [call("incidents.alert_rules.ignore_update_missing_incidents_performance")]
            )

    @patch("sentry.incidents.subscription_processor.metrics")
    def test_has_downgraded_on_demand(self, mock_metrics: MagicMock) -> None:
        snuba_query = self.get_snuba_query(self.detector)
        snuba_query.update(time_window=15 * 60, dataset=Dataset.PerformanceMetrics.value)
        snuba_query.save()

        processor = SubscriptionProcessor(self.sub)
        message = self.build_subscription_update(
            self.sub, value=self.critical_threshold + 1, time_delta=timedelta()
        )

        with self.capture_on_commit_callbacks(execute=True):
            assert processor.process_update(message) is False
            mock_metrics.incr.assert_has_calls(
                [call("incidents.alert_rules.ignore_update_missing_on_demand")]
            )

    @patch("sentry.incidents.subscription_processor.metrics")
    def test_skip_already_processed_update(self, mock_metrics: MagicMock) -> None:
        assert self.send_update(value=self.critical_threshold + 1) is True
        mock_metrics.incr.reset_mock()
        assert self.send_update(value=self.critical_threshold + 1) is False

        mock_metrics.incr.assert_called_once_with(
            "incidents.alert_rules.skipping_already_processed_update"
        )
        mock_metrics.incr.reset_mock()
        assert (
            self.send_update(value=self.critical_threshold + 1, time_delta=timedelta(hours=1))
            is True
        )

        mock_metrics.incr.assert_called_once_with("incidents.alert_rules.process_update.start")

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

        processor = SubscriptionProcessor(self.sub)
        message = self.build_upsampled_subscription_update(
            self.sub, upsampled_count=upsampled_count, time_delta=time_delta
        )
        with (
            self.feature("organizations:incidents"),
            self.feature("organizations:performance-view"),
        ):
            processor.process_update(message)

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
