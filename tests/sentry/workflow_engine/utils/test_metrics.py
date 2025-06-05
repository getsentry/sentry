from unittest import mock

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.utils.metrics import metrics_incr
from sentry.workflow_engine.utils.workflow_context import WorkflowContext


class TestMetricsGetMetricName(TestCase):
    def test_metrics_name(self):
        # Get the method name, this isn't as dynamic as implemented, but
        # it will have an error if the name changes to also update this.
        method_name = TestMetricsGetMetricName.test_metrics_name.__name__

        with mock.patch("sentry.utils.metrics.incr") as mock_incr:
            metrics_incr("example.metric")
            mock_incr.assert_called_once_with(f"workflow_engine.{method_name}.example.metric", 1)


@mock.patch("sentry.workflow_engine.utils.metrics.inspect.stack")
class TestMetrics(TestCase):
    method_name = "test_caller"

    def create_mock_callstack(self, mock_stack):
        mock_stack.return_value = [
            mock.MagicMock(),  # Current frame (log_caller)
            mock.MagicMock(function=self.method_name),  # Calling frame
        ]

    def test(self, mock_stack):
        self.create_mock_callstack(mock_stack)

        with mock.patch("sentry.utils.metrics.incr") as mock_incr:
            metrics_incr("example.metric")
            mock_incr.assert_called_once_with(
                f"workflow_engine.{self.method_name}.example.metric", 1
            )

    def test_many(self, mock_stack):
        self.create_mock_callstack(mock_stack)

        with mock.patch("sentry.utils.metrics.incr") as mock_incr:
            metrics_incr("example.metric", 2)
            mock_incr.assert_called_once_with(
                f"workflow_engine.{self.method_name}.example.metric", 2
            )

    def test_with_context(self, mock_stack):
        self.create_mock_callstack(mock_stack)
        detector = self.create_detector()
        WorkflowContext.set(detector=detector)

        with mock.patch("sentry.utils.metrics.incr") as mock_incr:
            metrics_incr("example.metric")
            mock_incr.assert_called_once_with(
                f"workflow_engine.{self.method_name}.example.metric",
                1,
                tags={"detector_type": detector.type},
            )
