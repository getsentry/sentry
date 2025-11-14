from typing import int
import copy
from datetime import timedelta
from functools import cached_property
from unittest.mock import call, patch

from django.utils import timezone

from sentry.testutils.factories import DEFAULT_EVENT_DATA
from sentry.workflow_engine.models.data_condition import Condition, DataCondition
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.incidents.subscription_processor.test_subscription_processor_base import (
    ProcessUpdateBaseClass,
)


class ProcessUpdateTest(ProcessUpdateBaseClass):
    """
    Test early return scenarios + simple cases.
    """

    # TODO: tests for early return scenarios. These will need to be added once
    # we've decoupled the subscription processor from the alert rule model.

    def test_simple(self) -> None:
        """
        Verify that an alert can trigger.
        """
        self.send_update(self.critical_threshold + 1)
        assert self.get_detector_state(self.metric_detector) == DetectorPriorityLevel.HIGH

    def test_resolve(self) -> None:
        detector = self.metric_detector
        self.send_update(self.critical_threshold + 1, timedelta(minutes=-2))
        assert self.get_detector_state(detector) == DetectorPriorityLevel.HIGH

        self.send_update(self.resolve_threshold - 1, timedelta(minutes=-1))
        assert self.get_detector_state(detector) == DetectorPriorityLevel.OK

    def test_resolve_percent_boundary(self) -> None:
        detector = self.metric_detector
        self.update_threshold(detector, DetectorPriorityLevel.HIGH, 0.5)
        self.update_threshold(detector, DetectorPriorityLevel.OK, 0.5)
        self.send_update(self.critical_threshold + 0.1, timedelta(minutes=-2))
        assert self.get_detector_state(detector) == DetectorPriorityLevel.HIGH

        self.send_update(self.resolve_threshold, timedelta(minutes=-1))
        assert self.get_detector_state(detector) == DetectorPriorityLevel.OK

    def test_reversed(self) -> None:
        """
        Test that resolutions work when the threshold is reversed.
        """
        detector = self.metric_detector
        DataCondition.objects.filter(condition_group=detector.workflow_condition_group).delete()
        self.set_up_data_conditions(detector, Condition.LESS, 100, None, 100)
        self.send_update(self.critical_threshold - 1, timedelta(minutes=-2))
        assert self.get_detector_state(detector) == DetectorPriorityLevel.HIGH

        self.send_update(self.resolve_threshold, timedelta(minutes=-1))
        assert self.get_detector_state(detector) == DetectorPriorityLevel.OK

    def test_multiple_triggers(self) -> None:
        detector = self.metric_detector
        DataCondition.objects.filter(condition_group=detector.workflow_condition_group).delete()
        self.set_up_data_conditions(detector, Condition.GREATER, 100, 50, 50)

        self.send_update(self.warning_threshold + 1, timedelta(minutes=-5))
        assert self.get_detector_state(detector) == DetectorPriorityLevel.MEDIUM

        self.send_update(self.critical_threshold + 1, timedelta(minutes=-4))
        assert self.get_detector_state(detector) == DetectorPriorityLevel.HIGH

        self.send_update(self.critical_threshold - 1, timedelta(minutes=-3))
        assert self.get_detector_state(detector) == DetectorPriorityLevel.MEDIUM

        self.send_update(self.warning_threshold - 1, timedelta(minutes=-2))
        assert self.get_detector_state(detector) == DetectorPriorityLevel.OK

    def test_multiple_triggers_reversed(self) -> None:
        detector = self.metric_detector
        DataCondition.objects.filter(condition_group=detector.workflow_condition_group).delete()
        self.set_up_data_conditions(detector, Condition.LESS, 50, 100, 100)

        self.send_update(self.warning_threshold - 1, timedelta(minutes=-5))
        assert self.get_detector_state(detector) == DetectorPriorityLevel.MEDIUM

        self.send_update(self.critical_threshold - 1, timedelta(minutes=-4))
        assert self.get_detector_state(detector) == DetectorPriorityLevel.HIGH

        self.send_update(self.critical_threshold + 1, timedelta(minutes=-3))
        assert self.get_detector_state(detector) == DetectorPriorityLevel.MEDIUM

        self.send_update(self.warning_threshold + 1, timedelta(minutes=-2))
        assert self.get_detector_state(detector) == DetectorPriorityLevel.OK

    # TODO: the subscription processor has a 10 minute cooldown period for creating new incidents
    # We probably need similar logic within workflow engine.


class ProcessUpdateComparisonAlertTest(ProcessUpdateBaseClass):
    @cached_property
    def comparison_detector_above(self):
        detector = self.metric_detector
        detector.config.update({"comparison_delta": 60 * 60})
        detector.save()
        self.update_threshold(detector, DetectorPriorityLevel.HIGH, 150)
        self.update_threshold(detector, DetectorPriorityLevel.OK, 150)
        snuba_query = self.get_snuba_query(detector)
        snuba_query.update(time_window=60 * 60)
        return detector

    @cached_property
    def comparison_detector_below(self):
        detector = self.metric_detector
        detector.config.update({"comparison_delta": 60 * 60})
        detector.save()
        DataCondition.objects.filter(condition_group=detector.workflow_condition_group).delete()
        self.set_up_data_conditions(detector, Condition.LESS, 50, None, 50)
        snuba_query = self.get_snuba_query(detector)
        snuba_query.update(time_window=60 * 60)
        return detector

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
