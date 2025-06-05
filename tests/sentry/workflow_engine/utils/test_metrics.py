from unittest import mock

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.utils.metrics import metrics_incr
from sentry.workflow_engine.utils.workflow_context import WorkflowContext


@mock.patch("sentry.utils.metrics.incr")
class TestMetrics(TestCase):
    def test(self, mock_incr):
        metrics_incr("example.metric")
        mock_incr.assert_called_once_with("workflow_engine.example.metric", 1)

    def test_many(self, mock_incr):
        metrics_incr("example.metric", 2)
        mock_incr.assert_called_once_with("workflow_engine.example.metric", 2)

    def test_with_context(self, mock_incr):
        detector = self.create_detector()
        WorkflowContext.set(detector=detector)

        metrics_incr("example.metric")
        mock_incr.assert_called_with(
            "workflow_engine.example.metric",
            1,
            tags={"detector_type": detector.type},
        )
