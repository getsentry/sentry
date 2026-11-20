from unittest import mock

from sentry.workflow_engine.processors.contexts.workflow_event_context import (
    WorkflowEventContext,
    WorkflowEventContextData,
)
from sentry.workflow_engine.utils.metrics import metrics_incr
from tests.sentry.workflow_engine.processors.contexts.test_workflow_event_context import (
    WorkflowEventContextTestCase,
)


@mock.patch("sentry.utils.metrics.incr")
class TestWorkflowEngineMetrics(WorkflowEventContextTestCase):
    def test(self, mock_incr: mock.MagicMock) -> None:
        metrics_incr("example.metric")
        mock_incr.assert_called_once_with("workflow_engine.example.metric", 1)

    def test_many(self, mock_incr: mock.MagicMock) -> None:
        metrics_incr("example.metric", 2)
        mock_incr.assert_called_once_with("workflow_engine.example.metric", 2)

    def test_with_context(self, mock_incr: mock.MagicMock) -> None:
        detector = self.create_detector()
        WorkflowEventContext.set(WorkflowEventContextData(detector=detector))

        metrics_incr("example.metric")
        mock_incr.assert_called_with(
            "workflow_engine.example.metric",
            1,
            tags={"detector_type": detector.type},
        )
