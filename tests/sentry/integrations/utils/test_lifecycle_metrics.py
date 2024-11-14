from unittest import mock

from sentry.integrations.base import IntegrationDomain
from sentry.integrations.types import EventLifecycleOutcome
from sentry.integrations.utils.metrics import IntegrationEventLifecycleMetric
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
class IntegrationEventLifecycleMetricTest(TestCase):
    class TestLifecycleMetric(IntegrationEventLifecycleMetric):
        def get_integration_domain(self) -> IntegrationDomain:
            return IntegrationDomain.MESSAGING

        def get_integration_name(self) -> str:
            return "my_integration"

        def get_interaction_type(self) -> str:
            return "my_interaction"

    def test_key_and_tag_assignment(self):
        metric_obj = self.TestLifecycleMetric()

        key = metric_obj.get_metric_key(EventLifecycleOutcome.STARTED)
        assert key == "integrations.slo.started"
        assert metric_obj.get_metric_tags() == {
            "integration_domain": "messaging",
            "integration_name": "my_integration",
            "interaction_type": "my_interaction",
        }

    @staticmethod
    def _check_metrics_call_args(mock_metrics, expected_termination: str):
        assert mock_metrics.incr.call_args_list == [
            mock.call(
                "integrations.slo.started",
                tags={
                    "integration_domain": "messaging",
                    "integration_name": "my_integration",
                    "interaction_type": "my_interaction",
                },
                sample_rate=1.0,
            ),
            mock.call(
                rf"integrations.slo.{expected_termination}",
                tags={
                    "integration_domain": "messaging",
                    "integration_name": "my_integration",
                    "interaction_type": "my_interaction",
                },
                sample_rate=1.0,
            ),
        ]

    @mock.patch("sentry.integrations.utils.metrics.logger")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_recording_success(self, mock_metrics, mock_logger):
        metric_obj = self.TestLifecycleMetric()
        with metric_obj.capture(assume_success=True):
            pass
        self._check_metrics_call_args(mock_metrics, "success")
        mock_logger.error.assert_not_called()

    @mock.patch("sentry.integrations.utils.metrics.logger")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_recording_halt(self, mock_metrics, mock_logger):
        metric_obj = self.TestLifecycleMetric()
        with metric_obj.capture(assume_success=False):
            pass
        self._check_metrics_call_args(mock_metrics, "halted")
        mock_logger.error.assert_not_called()

    @mock.patch("sentry.integrations.utils.metrics.logger")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_recording_failure(self, mock_metrics, mock_logger):
        class TestException(Exception):
            pass

        metric_obj = self.TestLifecycleMetric()
        try:
            with metric_obj.capture() as lifecycle:
                lifecycle.add_extra("extra", "value")
                raise TestException
        except TestException:
            pass
        else:
            self.fail()

        self._check_metrics_call_args(mock_metrics, "failure")
        mock_logger.error.assert_called_once_with(
            "integrations.slo.failure", extra={"extra": "value"}, exc_info=mock.ANY
        )
