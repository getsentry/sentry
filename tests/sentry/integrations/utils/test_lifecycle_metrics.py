from unittest import TestCase, mock

import pytest

from sentry.integrations.base import IntegrationDomain
from sentry.integrations.types import EventLifecycleOutcome
from sentry.integrations.utils.metrics import IntegrationEventLifecycleMetric
from sentry.testutils.silo import no_silo_test


class ExampleException(Exception):
    pass


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
        mock_logger.warning.assert_not_called()

    @mock.patch("sentry.integrations.utils.metrics.logger")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_recording_halt(self, mock_metrics, mock_logger):
        metric_obj = self.TestLifecycleMetric()
        with metric_obj.capture(assume_success=False):
            pass
        self._check_metrics_call_args(mock_metrics, "halted")
        mock_logger.warning.assert_called_once_with(
            "integrations.slo.halted",
            extra={
                "integration_domain": "messaging",
                "integration_name": "my_integration",
                "interaction_type": "my_interaction",
            },
        )

    @mock.patch("sentry.integrations.utils.metrics.logger")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_recording_explicit_halt_with_exception(self, mock_metrics, mock_logger):
        metric_obj = self.TestLifecycleMetric()
        with metric_obj.capture() as lifecycle:
            lifecycle.add_extra("extra", "value")
            lifecycle.record_halt(ExampleException(""), extra={"even": "more"})

        self._check_metrics_call_args(mock_metrics, "halted")
        mock_logger.warning.assert_called_once_with(
            "integrations.slo.halted",
            extra={
                "extra": "value",
                "even": "more",
                "integration_domain": "messaging",
                "integration_name": "my_integration",
                "interaction_type": "my_interaction",
                "exception_summary": repr(ExampleException("")),
            },
        )

    @mock.patch("sentry.integrations.utils.metrics.logger")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_recording_explicit_halt_with_str(self, mock_metrics, mock_logger):
        metric_obj = self.TestLifecycleMetric()
        with metric_obj.capture() as lifecycle:
            lifecycle.add_extra("extra", "value")
            lifecycle.record_halt("Integration went boom", extra={"even": "more"})

        self._check_metrics_call_args(mock_metrics, "halted")
        mock_logger.warning.assert_called_once_with(
            "integrations.slo.halted",
            extra={
                "outcome_reason": "Integration went boom",
                "extra": "value",
                "even": "more",
                "integration_domain": "messaging",
                "integration_name": "my_integration",
                "interaction_type": "my_interaction",
            },
        )

    @mock.patch("sentry.integrations.utils.metrics.sentry_sdk")
    @mock.patch("sentry.integrations.utils.metrics.logger")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_recording_failure(self, mock_metrics, mock_logger, mock_sentry_sdk):
        mock_sentry_sdk.capture_exception.return_value = "test-event-id"

        metric_obj = self.TestLifecycleMetric()
        with pytest.raises(ExampleException):
            with metric_obj.capture() as lifecycle:
                lifecycle.add_extra("extra", "value")
                raise ExampleException()

        self._check_metrics_call_args(mock_metrics, "failure")
        mock_sentry_sdk.capture_exception.assert_called_once()
        mock_logger.warning.assert_called_once_with(
            "integrations.slo.failure",
            extra={
                "extra": "value",
                "integration_domain": "messaging",
                "integration_name": "my_integration",
                "interaction_type": "my_interaction",
                "exception_summary": repr(ExampleException()),
                "slo_event_id": "test-event-id",
            },
        )

    @mock.patch("sentry.integrations.utils.metrics.sentry_sdk")
    @mock.patch("sentry.integrations.utils.metrics.logger")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_recording_explicit_failure_with_exception(
        self, mock_metrics, mock_logger, mock_sentry_sdk
    ):
        mock_sentry_sdk.capture_exception.return_value = "test-event-id"

        metric_obj = self.TestLifecycleMetric()
        with metric_obj.capture() as lifecycle:
            try:
                lifecycle.add_extra("extra", "value")
                raise ExampleException()
            except ExampleException as exc:
                lifecycle.record_failure(exc, extra={"even": "more"})

        self._check_metrics_call_args(mock_metrics, "failure")
        mock_sentry_sdk.capture_exception.assert_called_once()
        mock_logger.warning.assert_called_once_with(
            "integrations.slo.failure",
            extra={
                "extra": "value",
                "even": "more",
                "integration_domain": "messaging",
                "integration_name": "my_integration",
                "interaction_type": "my_interaction",
                "exception_summary": repr(ExampleException()),
                "slo_event_id": "test-event-id",
            },
        )

    @mock.patch("sentry.integrations.utils.metrics.logger")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_recording_explicit_failure_with_str(self, mock_metrics, mock_logger):
        metric_obj = self.TestLifecycleMetric()
        with metric_obj.capture() as lifecycle:
            lifecycle.add_extra("extra", "value")
            lifecycle.record_failure("Integration went boom", extra={"even": "more"})

        self._check_metrics_call_args(mock_metrics, "failure")
        mock_logger.warning.assert_called_once_with(
            "integrations.slo.failure",
            extra={
                "outcome_reason": "Integration went boom",
                "extra": "value",
                "even": "more",
                "integration_domain": "messaging",
                "integration_name": "my_integration",
                "interaction_type": "my_interaction",
            },
        )

    @mock.patch("sentry.integrations.utils.metrics.sentry_sdk")
    @mock.patch("sentry.integrations.utils.metrics.logger")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_recording_halt_with_create_issue_true(
        self, mock_metrics, mock_logger, mock_sentry_sdk
    ):
        """
        Test that halt can create Sentry issues when create_issue=True
        """
        mock_sentry_sdk.capture_exception.return_value = "test-event-id"

        metric_obj = self.TestLifecycleMetric()
        with metric_obj.capture() as lifecycle:
            lifecycle.add_extra("extra", "value")
            lifecycle.record_halt(ExampleException("test"), create_issue=True)

        self._check_metrics_call_args(mock_metrics, "halted")
        mock_sentry_sdk.capture_exception.assert_called_once()
        mock_logger.warning.assert_called_once_with(
            "integrations.slo.halted",
            extra={
                "extra": "value",
                "integration_domain": "messaging",
                "integration_name": "my_integration",
                "interaction_type": "my_interaction",
                "exception_summary": repr(ExampleException("test")),
                "slo_event_id": "test-event-id",
            },
        )

    @mock.patch("sentry.integrations.utils.metrics.logger")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_recording_failure_with_create_issue_false(self, mock_metrics, mock_logger):
        """
        Test that failure can skip creating Sentry issues when create_issue=False
        """
        metric_obj = self.TestLifecycleMetric()
        with metric_obj.capture() as lifecycle:
            lifecycle.add_extra("extra", "value")
            lifecycle.record_failure(ExampleException("test"), create_issue=False)

        self._check_metrics_call_args(mock_metrics, "failure")
        mock_logger.warning.assert_called_once_with(
            "integrations.slo.failure",
            extra={
                "extra": "value",
                "integration_domain": "messaging",
                "integration_name": "my_integration",
                "interaction_type": "my_interaction",
                "exception_summary": repr(ExampleException("test")),
            },
        )
