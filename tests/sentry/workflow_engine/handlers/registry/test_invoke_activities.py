from unittest import mock
from unittest.mock import MagicMock

from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType
from sentry.workflow_engine.handlers.registry import invoke_workflow_activity_handlers
from sentry.workflow_engine.handlers.registry.invoke_activities import DURATION_METRIC
from sentry.workflow_engine.registry import workflow_activity_registry


class InvokeWorkflowActivityHandlersTest(TestCase):
    def setUp(self) -> None:
        self.group = self.create_group()
        self.activity = self.create_group_activity(
            group=self.group, type=ActivityType.SEER_PR_CREATED.value
        )

    def test_invoke_handlers_safely(self) -> None:
        handler_a = mock.Mock()
        handler_b = mock.Mock(side_effect=Exception("Test error"))
        handler_c = mock.Mock()

        with mock.patch.dict(
            workflow_activity_registry.registrations,
            {"handler_a": handler_a, "handler_b": handler_b, "handler_c": handler_c},
            clear=True,
        ):
            invoke_workflow_activity_handlers(self.group, self.activity)

        # A raising handler does not prevent the others from running.
        handler_a.assert_called_once_with(self.group, self.activity, None)
        handler_b.assert_called_once_with(self.group, self.activity, None)
        handler_c.assert_called_once_with(self.group, self.activity, None)

    def test_invoke_handlers_no_registrants(self) -> None:
        with mock.patch.dict(workflow_activity_registry.registrations, {}, clear=True):
            invoke_workflow_activity_handlers(self.group, self.activity)

    def test_passes_detector_id_to_handlers(self) -> None:
        handler = mock.Mock()
        with mock.patch.dict(
            workflow_activity_registry.registrations, {"handler": handler}, clear=True
        ):
            invoke_workflow_activity_handlers(self.group, self.activity, detector_id=123)

        handler.assert_called_once_with(self.group, self.activity, 123)

    @mock.patch("sentry.workflow_engine.handlers.registry.invoke_activities.metrics")
    def test_emits_duration_metric_per_handler(self, mock_metrics: MagicMock) -> None:
        handler_a = mock.Mock()
        handler_b = mock.Mock()

        with mock.patch.dict(
            workflow_activity_registry.registrations,
            {"handler_a": handler_a, "handler_b": handler_b},
            clear=True,
        ):
            invoke_workflow_activity_handlers(self.group, self.activity)

        # One timing per handler, tagged by the registry key, for the overall duration.
        assert mock_metrics.timing.call_count == 2
        mock_metrics.timing.assert_any_call(
            DURATION_METRIC,
            mock.ANY,
            tags={"handler": "handler_a", "stat": "total_recording_duration"},
        )
        mock_metrics.timing.assert_any_call(
            DURATION_METRIC,
            mock.ANY,
            tags={"handler": "handler_b", "stat": "total_recording_duration"},
        )

    @mock.patch("sentry.workflow_engine.handlers.registry.invoke_activities.metrics")
    def test_emits_timing_when_handler_raises(self, mock_metrics: MagicMock) -> None:
        handler_a = mock.Mock(side_effect=Exception("Test error"))
        handler_b = mock.Mock()

        with mock.patch.dict(
            workflow_activity_registry.registrations,
            {"handler_a": handler_a, "handler_b": handler_b},
            clear=True,
        ):
            invoke_workflow_activity_handlers(self.group, self.activity)

        # Failed handlers are still timed, and the loop continues to the next handler.
        assert mock_metrics.timing.call_count == 2
        mock_metrics.timing.assert_any_call(
            DURATION_METRIC,
            mock.ANY,
            tags={"handler": "handler_a", "stat": "total_recording_duration"},
        )
        handler_b.assert_called_once_with(self.group, self.activity, None)
