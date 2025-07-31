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

    def test_key_and_tag_assignment(self) -> None:
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
    def test_recording_success(
        self, mock_metrics: mock.MagicMock, mock_logger: mock.MagicMock
    ) -> None:
        metric_obj = self.TestLifecycleMetric()
        with metric_obj.capture(assume_success=True):
            pass
        self._check_metrics_call_args(mock_metrics, "success")
        mock_logger.error.assert_not_called()
        mock_logger.warning.assert_not_called()

    @mock.patch("sentry.integrations.utils.metrics.logger")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_recording_halt(
        self, mock_metrics: mock.MagicMock, mock_logger: mock.MagicMock
    ) -> None:
        metric_obj = self.TestLifecycleMetric()
        with metric_obj.capture(assume_success=False):
            pass
        self._check_metrics_call_args(mock_metrics, "halted")
        mock_logger.info.assert_called_once_with(
            "integrations.slo.halted",
            extra={
                "integration_domain": "messaging",
                "integration_name": "my_integration",
                "interaction_type": "my_interaction",
            },
        )

    @mock.patch("sentry.integrations.utils.metrics.logger")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_recording_explicit_halt_with_exception(
        self, mock_metrics: mock.MagicMock, mock_logger: mock.MagicMock
    ) -> None:
        metric_obj = self.TestLifecycleMetric()
        with metric_obj.capture() as lifecycle:
            lifecycle.add_extra("extra", "value")
            lifecycle.record_halt(ExampleException(""), extra={"even": "more"})

        self._check_metrics_call_args(mock_metrics, "halted")
        mock_logger.info.assert_called_once_with(
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
    def test_recording_explicit_halt_with_str(
        self, mock_metrics: mock.MagicMock, mock_logger: mock.MagicMock
    ) -> None:
        metric_obj = self.TestLifecycleMetric()
        with metric_obj.capture() as lifecycle:
            lifecycle.add_extra("extra", "value")
            lifecycle.record_halt("Integration went boom", extra={"even": "more"})

        self._check_metrics_call_args(mock_metrics, "halted")
        mock_logger.info.assert_called_once_with(
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
    def test_recording_failure(
        self,
        mock_metrics: mock.MagicMock,
        mock_logger: mock.MagicMock,
        mock_sentry_sdk: mock.MagicMock,
    ) -> None:
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
    def test_recording_explicit_failure_with_str(
        self, mock_metrics: mock.MagicMock, mock_logger: mock.MagicMock
    ) -> None:
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
        mock_logger.info.assert_called_once_with(
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
    def test_recording_failure_with_create_issue_false(
        self, mock_metrics: mock.MagicMock, mock_logger: mock.MagicMock
    ) -> None:
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

    @mock.patch("sentry.integrations.utils.metrics.random")
    @mock.patch("sentry.integrations.utils.metrics.logger")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_sample_log_rate_always_logs_when_rate_is_one(
        self, mock_metrics, mock_logger, mock_random
    ):
        """Test that sample_log_rate=1.0 always logs (default behavior)"""
        metric_obj = self.TestLifecycleMetric()

        with metric_obj.capture(sample_log_rate=1.0) as lifecycle:
            lifecycle.record_failure("test failure")

        # Metrics should always be called
        self._check_metrics_call_args(mock_metrics, "failure")
        # Logger should be called since rate is 1.0
        mock_logger.warning.assert_called_once()
        # random.random() should not be called when rate >= 1.0
        mock_random.random.assert_not_called()

    @mock.patch("sentry.integrations.utils.metrics.random")
    @mock.patch("sentry.integrations.utils.metrics.logger")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_sample_log_rate_logs_when_random_passes(
        self, mock_metrics: mock.MagicMock, mock_logger: mock.MagicMock, mock_random: mock.MagicMock
    ) -> None:
        """Test that logging occurs when random value is below sample rate"""
        mock_random.random.return_value = 0.05  # Below 0.1 threshold

        metric_obj = self.TestLifecycleMetric()
        with metric_obj.capture(sample_log_rate=0.1) as lifecycle:
            lifecycle.record_failure("test failure")

        # Metrics should always be called
        self._check_metrics_call_args(mock_metrics, "failure")
        # Logger should be called since 0.05 < 0.1
        mock_logger.warning.assert_called_once()
        mock_random.random.assert_called_once()

    @mock.patch("sentry.integrations.utils.metrics.random")
    @mock.patch("sentry.integrations.utils.metrics.logger")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_sample_log_rate_skips_when_random_fails(
        self, mock_metrics: mock.MagicMock, mock_logger: mock.MagicMock, mock_random: mock.MagicMock
    ) -> None:
        """Test that logging is skipped when random value is above sample rate"""
        mock_random.random.return_value = 0.15  # Above 0.1 threshold

        metric_obj = self.TestLifecycleMetric()
        with metric_obj.capture(sample_log_rate=0.1) as lifecycle:
            lifecycle.record_failure("test failure")

        # Metrics should always be called
        self._check_metrics_call_args(mock_metrics, "failure")
        # Logger should NOT be called since 0.15 > 0.1
        mock_logger.warning.assert_not_called()
        mock_random.random.assert_called_once()

    @mock.patch("sentry.integrations.utils.metrics.random")
    @mock.patch("sentry.integrations.utils.metrics.logger")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_sample_log_rate_halt_with_sampling(
        self, mock_metrics: mock.MagicMock, mock_logger: mock.MagicMock, mock_random: mock.MagicMock
    ) -> None:
        """Test that halt logging respects sample rate"""
        mock_random.random.return_value = 0.05  # Below 0.2 threshold

        metric_obj = self.TestLifecycleMetric()
        with metric_obj.capture(sample_log_rate=0.2) as lifecycle:
            lifecycle.record_halt("test halt")

        # Metrics should always be called
        self._check_metrics_call_args(mock_metrics, "halted")
        # Logger should be called since 0.05 < 0.2
        mock_logger.info.assert_called_once()
        mock_random.random.assert_called_once()

    @mock.patch("sentry.integrations.utils.metrics.random")
    @mock.patch("sentry.integrations.utils.metrics.logger")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_per_call_sample_log_rate_overrides_instance_rate(
        self, mock_metrics, mock_logger, mock_random
    ):
        """Test that per-call sample_log_rate overrides instance default"""
        mock_random.random.return_value = 0.15  # Between 0.1 and 0.3

        metric_obj = self.TestLifecycleMetric()
        with metric_obj.capture(sample_log_rate=0.1) as lifecycle:
            # Per-call rate of 0.3 should override instance rate of 0.1
            lifecycle.record_failure("test failure", sample_log_rate=0.3)

        # Metrics should always be called
        self._check_metrics_call_args(mock_metrics, "failure")
        # Logger should be called since 0.15 < 0.3 (per-call rate)
        mock_logger.warning.assert_called_once()
        mock_random.random.assert_called_once()

    @mock.patch("sentry.integrations.utils.metrics.random")
    @mock.patch("sentry.integrations.utils.metrics.logger")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_per_call_sample_log_rate_skips_when_below_threshold(
        self, mock_metrics, mock_logger, mock_random
    ):
        """Test that per-call sample_log_rate can cause skipping even with higher instance rate"""
        mock_random.random.return_value = 0.15  # Between 0.05 and 1.0

        metric_obj = self.TestLifecycleMetric()
        with metric_obj.capture(sample_log_rate=1.0) as lifecycle:
            # Per-call rate of 0.05 should override instance rate of 1.0
            lifecycle.record_halt("test halt", sample_log_rate=0.05)

        # Metrics should always be called
        self._check_metrics_call_args(mock_metrics, "halted")
        # Logger should NOT be called since 0.15 > 0.05 (per-call rate)
        mock_logger.info.assert_not_called()
        mock_random.random.assert_called_once()

    @mock.patch("sentry.integrations.utils.metrics.random")
    @mock.patch("sentry.integrations.utils.metrics.logger")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_zero_sample_log_rate_never_logs(
        self, mock_metrics: mock.MagicMock, mock_logger: mock.MagicMock, mock_random: mock.MagicMock
    ) -> None:
        """Test that sample_log_rate=0.0 never logs"""
        mock_random.random.return_value = 0.0  # Even lowest possible random value

        metric_obj = self.TestLifecycleMetric()
        with metric_obj.capture(sample_log_rate=0.0) as lifecycle:
            lifecycle.record_failure("test failure")

        # Metrics should always be called
        self._check_metrics_call_args(mock_metrics, "failure")
        # Logger should NOT be called since rate is 0.0
        mock_logger.warning.assert_not_called()
        # Random should still be called for 0.0 < 1.0 check
        mock_random.random.assert_called_once()

    @mock.patch("sentry.integrations.utils.metrics.random")
    @mock.patch("sentry.integrations.utils.metrics.logger")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_sample_log_rate_on_exception_exit(
        self, mock_metrics: mock.MagicMock, mock_logger: mock.MagicMock, mock_random: mock.MagicMock
    ) -> None:
        """Test that sample rate is respected when exiting context with exception"""
        mock_random.random.return_value = 0.15  # Above 0.1 threshold

        metric_obj = self.TestLifecycleMetric()

        with pytest.raises(ExampleException):
            with metric_obj.capture(sample_log_rate=0.1):
                raise ExampleException("test")

        # Metrics should always be called
        self._check_metrics_call_args(mock_metrics, "failure")
        # Logger should NOT be called since 0.15 > 0.1
        mock_logger.warning.assert_not_called()
        mock_random.random.assert_called_once()

    @mock.patch("sentry.integrations.utils.metrics.random")
    @mock.patch("sentry.integrations.utils.metrics.logger")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_sample_log_rate_on_assume_success_false_exit(
        self, mock_metrics, mock_logger, mock_random
    ):
        """Test that sample rate is respected when exiting context with assume_success=False"""
        mock_random.random.return_value = 0.25  # Above 0.2 threshold

        metric_obj = self.TestLifecycleMetric()
        with metric_obj.capture(assume_success=False, sample_log_rate=0.2):
            pass  # Exit without explicit success/failure

        # Metrics should always be called
        self._check_metrics_call_args(mock_metrics, "halted")
        # Logger should NOT be called since 0.25 > 0.2
        mock_logger.info.assert_not_called()
        mock_random.random.assert_called_once()

    @mock.patch("sentry.integrations.utils.metrics.logger")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_default_sample_log_rate_is_one(
        self, mock_metrics: mock.MagicMock, mock_logger: mock.MagicMock
    ) -> None:
        """Test that default sample_log_rate is 1.0 (always log)"""
        metric_obj = self.TestLifecycleMetric()

        # Test default through capture()
        with metric_obj.capture() as lifecycle:
            lifecycle.record_failure("test failure")

        # Should log since default is 1.0
        mock_logger.warning.assert_called_once()

        mock_logger.reset_mock()
        mock_metrics.reset_mock()

        # Test default through constructor
        with metric_obj.capture(assume_success=False):
            pass  # Will record halt

        # Should log since default is 1.0
        mock_logger.info.assert_called_once()

    # Decorator tests
    @mock.patch("sentry.integrations.utils.metrics.logger")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_decorator_success(
        self, mock_metrics: mock.MagicMock, mock_logger: mock.MagicMock
    ) -> None:
        """Test that decorator records success for functions that complete normally"""
        from sentry.integrations.utils.metrics import event_lifecycle_decorator

        metric_obj = self.TestLifecycleMetric()

        @event_lifecycle_decorator(metric_obj)
        def test_function():
            return "success"

        result = test_function()

        assert result == "success"
        self._check_metrics_call_args(mock_metrics, "success")
        mock_logger.error.assert_not_called()
        mock_logger.warning.assert_not_called()

    @mock.patch("sentry.integrations.utils.metrics.logger")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_decorator_failure(
        self, mock_metrics: mock.MagicMock, mock_logger: mock.MagicMock
    ) -> None:
        """Test that decorator records failure for unhandled exceptions"""
        from sentry.integrations.utils.metrics import event_lifecycle_decorator

        metric_obj = self.TestLifecycleMetric()

        @event_lifecycle_decorator(metric_obj)
        def test_function():
            raise ExampleException("test error")

        with pytest.raises(ExampleException):
            test_function()

        self._check_metrics_call_args(mock_metrics, "failure")

    @mock.patch("sentry.integrations.utils.metrics.logger")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_decorator_halt_on_specific_exceptions(
        self, mock_metrics: mock.MagicMock, mock_logger: mock.MagicMock
    ) -> None:
        """Test that decorator records halt for specified exception types"""
        from sentry.integrations.utils.metrics import event_lifecycle_decorator

        metric_obj = self.TestLifecycleMetric()

        @event_lifecycle_decorator(metric_obj, halt_on_exceptions=[ExampleException])
        def test_function():
            raise ExampleException("this should be a halt")

        with pytest.raises(ExampleException):
            test_function()

        self._check_metrics_call_args(mock_metrics, "halted")
        mock_logger.info.assert_called_once_with(
            "integrations.slo.halted",
            extra={
                "integration_domain": "messaging",
                "integration_name": "my_integration",
                "interaction_type": "my_interaction",
                "exception_summary": repr(ExampleException("this should be a halt")),
            },
        )

    @mock.patch("sentry.integrations.utils.metrics.logger")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_decorator_halt_vs_failure_exception_types(
        self, mock_metrics: mock.MagicMock, mock_logger: mock.MagicMock
    ) -> None:
        """Test that decorator correctly distinguishes between halt and failure exceptions"""
        from sentry.integrations.utils.metrics import event_lifecycle_decorator

        class HaltException(Exception):
            pass

        class FailureException(Exception):
            pass

        metric_obj = self.TestLifecycleMetric()

        @event_lifecycle_decorator(metric_obj, halt_on_exceptions=[HaltException])
        def test_function_halt():
            raise HaltException("should halt")

        @event_lifecycle_decorator(metric_obj, halt_on_exceptions=[HaltException])
        def test_function_failure():
            raise FailureException("should fail")

        # Test halt exception
        with pytest.raises(HaltException):
            test_function_halt()

        self._check_metrics_call_args(mock_metrics, "halted")
        mock_logger.info.assert_called_once()

        # Reset mocks
        mock_metrics.reset_mock()
        mock_logger.reset_mock()

        # Test failure exception
        with pytest.raises(FailureException):
            test_function_failure()

        self._check_metrics_call_args(mock_metrics, "failure")
        mock_logger.warning.assert_called_once()

    @mock.patch("sentry.integrations.utils.metrics.logger")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_decorator_assume_success_false(
        self, mock_metrics: mock.MagicMock, mock_logger: mock.MagicMock
    ) -> None:
        """Test that decorator respects assume_success=False"""
        from sentry.integrations.utils.metrics import event_lifecycle_decorator

        metric_obj = self.TestLifecycleMetric()

        @event_lifecycle_decorator(metric_obj, assume_success=False)
        def test_function():
            return "completed"

        result = test_function()

        assert result == "completed"
        self._check_metrics_call_args(mock_metrics, "halted")

    @mock.patch("sentry.integrations.utils.metrics.random")
    @mock.patch("sentry.integrations.utils.metrics.logger")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_decorator_sample_log_rate(
        self, mock_metrics: mock.MagicMock, mock_logger: mock.MagicMock, mock_random: mock.MagicMock
    ) -> None:
        """Test that decorator respects sample_log_rate parameter"""
        from sentry.integrations.utils.metrics import event_lifecycle_decorator

        mock_random.random.return_value = 0.15  # Above 0.1 threshold

        metric_obj = self.TestLifecycleMetric()

        @event_lifecycle_decorator(
            metric_obj, sample_log_rate=0.1, halt_on_exceptions=[ExampleException]
        )
        def test_function():
            raise ExampleException("test")

        with pytest.raises(ExampleException):
            test_function()

        # Metrics should always be called
        self._check_metrics_call_args(mock_metrics, "halted")
        # Logger should NOT be called since 0.15 > 0.1
        mock_logger.info.assert_not_called()
        mock_random.random.assert_called_once()

    @mock.patch("sentry.integrations.utils.metrics.logger")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_decorator_inheritance_with_halt_exceptions(
        self, mock_metrics: mock.MagicMock, mock_logger: mock.MagicMock
    ) -> None:
        """Test that decorator handles exception inheritance correctly"""
        from sentry.integrations.utils.metrics import event_lifecycle_decorator

        class BaseHaltException(Exception):
            pass

        class DerivedHaltException(BaseHaltException):
            pass

        metric_obj = self.TestLifecycleMetric()

        @event_lifecycle_decorator(metric_obj, halt_on_exceptions=[BaseHaltException])
        def test_function():
            raise DerivedHaltException("derived exception")

        with pytest.raises(DerivedHaltException):
            test_function()

        # Should be treated as halt since DerivedHaltException inherits from BaseHaltException
        self._check_metrics_call_args(mock_metrics, "halted")
        mock_logger.info.assert_called_once()

    @mock.patch("sentry.integrations.utils.metrics.logger")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_decorator_function_arguments_preserved(
        self, mock_metrics: mock.MagicMock, mock_logger: mock.MagicMock
    ) -> None:
        """Test that decorator preserves function arguments and return values"""
        from sentry.integrations.utils.metrics import event_lifecycle_decorator

        metric_obj = self.TestLifecycleMetric()

        @event_lifecycle_decorator(metric_obj)
        def test_function(arg1, arg2, kwarg1=None, kwarg2=None):
            return f"{arg1}-{arg2}-{kwarg1}-{kwarg2}"

        result = test_function("a", "b", kwarg1="c", kwarg2="d")

        assert result == "a-b-c-d"
        self._check_metrics_call_args(mock_metrics, "success")
