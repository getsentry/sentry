from unittest import TestCase, mock

import pytest

from sentry.exceptions import RestrictedIPAddress
from sentry.integrations.base import IntegrationDomain
from sentry.integrations.types import EventLifecycleOutcome
from sentry.integrations.utils.metrics import (
    IntegrationEventLifecycleMetric,
    _has_connectivity_error_in_chain,
)
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

        def get_integration_id(self) -> int | None:
            return 123

    def setUp(self) -> None:
        patcher = mock.patch("sentry.integrations.utils.metrics.options.get", return_value=True)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_key_and_tag_assignment(self) -> None:
        metric_obj = self.TestLifecycleMetric()

        key = metric_obj.get_metric_key(EventLifecycleOutcome.STARTED)
        assert key == "integrations.slo.started"
        assert metric_obj.get_metric_tags() == {
            "integration_domain": "messaging",
            "integration_name": "my_integration",
            "interaction_type": "my_interaction",
            "integration_id": "123",
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
                    "integration_id": "123",
                },
                sample_rate=1.0,
            ),
            mock.call(
                rf"integrations.slo.{expected_termination}",
                tags={
                    "integration_domain": "messaging",
                    "integration_name": "my_integration",
                    "interaction_type": "my_interaction",
                    "integration_id": "123",
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
        mock_logger.warning.assert_called_once_with(
            "integrations.slo.halted",
            extra={
                "integration_domain": "messaging",
                "integration_name": "my_integration",
                "interaction_type": "my_interaction",
                "integration_id": "123",
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
        mock_logger.warning.assert_called_once_with(
            "integrations.slo.halted",
            extra={
                "extra": "value",
                "even": "more",
                "integration_domain": "messaging",
                "integration_name": "my_integration",
                "interaction_type": "my_interaction",
                "integration_id": "123",
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
        mock_logger.warning.assert_called_once_with(
            "integrations.slo.halted",
            extra={
                "outcome_reason": "Integration went boom",
                "extra": "value",
                "even": "more",
                "integration_domain": "messaging",
                "integration_name": "my_integration",
                "interaction_type": "my_interaction",
                "integration_id": "123",
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
                "integration_id": "123",
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
                "integration_id": "123",
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
                "integration_id": "123",
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
                "integration_id": "123",
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
                "integration_id": "123",
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
        mock_logger.warning.assert_called_once()
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
        mock_logger.warning.assert_not_called()
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
        mock_logger.warning.assert_not_called()
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
        mock_logger.warning.assert_called_once()


class HasConnectivityErrorInChainTest(TestCase):
    """Unit tests for the _has_connectivity_error_in_chain helper."""

    def test_returns_false_for_none(self) -> None:
        assert not _has_connectivity_error_in_chain(None)

    def test_returns_false_for_unrelated_exception(self) -> None:
        assert not _has_connectivity_error_in_chain(ValueError("unrelated"))

    def test_detects_timeout_error_directly(self) -> None:
        assert _has_connectivity_error_in_chain(TimeoutError("timed out"))

    def test_detects_connection_refused_directly(self) -> None:
        assert _has_connectivity_error_in_chain(ConnectionRefusedError("refused"))

    def test_detects_connection_reset_directly(self) -> None:
        assert _has_connectivity_error_in_chain(ConnectionResetError("reset"))

    def test_detects_connection_error_subtype_via_explicit_cause(self) -> None:
        """Explicit chaining: raise Wrapper() from TimeoutError()"""
        inner = TimeoutError("timed out")
        outer = RuntimeError("wrapper")
        outer.__cause__ = inner
        assert _has_connectivity_error_in_chain(outer)

    def test_detects_timeout_via_implicit_context(self) -> None:
        """Implicit chaining: raise Wrapper() inside except TimeoutError block."""
        inner = TimeoutError("timed out")
        outer = RuntimeError("wrapper")
        outer.__context__ = inner
        assert _has_connectivity_error_in_chain(outer)

    def test_detects_connectivity_error_two_levels_deep(self) -> None:
        """Chain: OuterError -> MiddleError -> TimeoutError (all implicit)."""
        root = TimeoutError("TCP connect timed out")
        middle = RuntimeError("P4Exception wrapping the OS error")
        middle.__context__ = root
        outer = RuntimeError("ApiError wrapping P4Exception")
        outer.__context__ = middle
        assert _has_connectivity_error_in_chain(outer)

    def test_does_not_detect_unrelated_oserror_subtype(self) -> None:
        """PermissionError is an OSError but not a connectivity error."""
        assert not _has_connectivity_error_in_chain(PermissionError("permission denied"))

    def test_handles_cycle_in_exception_chain(self) -> None:
        """Guard against a cyclic __context__ chain (should not loop forever)."""
        exc_a = RuntimeError("a")
        exc_b = RuntimeError("b")
        exc_a.__context__ = exc_b
        exc_b.__context__ = exc_a  # cycle
        # Neither is a connectivity error; must not infinite-loop.
        assert not _has_connectivity_error_in_chain(exc_a)


@no_silo_test
class IntegrationEventLifecycleConnectivityHaltTest(TestCase):
    """Tests that IntegrationEventLifecycle halts (not fails) on connectivity errors."""

    class TestLifecycleMetric(IntegrationEventLifecycleMetric):
        def get_integration_domain(self) -> IntegrationDomain:
            return IntegrationDomain.SOURCE_CODE_MANAGEMENT

        def get_integration_name(self) -> str:
            return "perforce"

        def get_interaction_type(self) -> str:
            return "sync_repos"

    def setUp(self) -> None:
        patcher = mock.patch("sentry.integrations.utils.metrics.options.get", return_value=False)
        patcher.start()
        self.addCleanup(patcher.stop)

    @mock.patch("sentry.integrations.utils.metrics.sentry_sdk")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_timeout_error_in_chain_records_halt_not_failure(
        self, mock_metrics: mock.MagicMock, mock_sentry_sdk: mock.MagicMock
    ) -> None:
        """A TimeoutError anywhere in the exception chain should halt, not fail."""
        root = TimeoutError("TCP connect timed out")
        middle = RuntimeError("P4Exception: connect to server failed")
        middle.__context__ = root
        outer = RuntimeError("ApiError: Failed to connect to Perforce")
        outer.__context__ = middle

        metric_obj = self.TestLifecycleMetric()
        with pytest.raises(RuntimeError):
            with metric_obj.capture():
                raise outer

        # Must record a halt, not a failure
        assert mock_metrics.incr.call_args_list[-1][0][0] == "integrations.slo.halted"
        # Must NOT call capture_exception (no Sentry issue created)
        mock_sentry_sdk.capture_exception.assert_not_called()

    @mock.patch("sentry.integrations.utils.metrics.sentry_sdk")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_connection_refused_in_chain_records_halt(
        self, mock_metrics: mock.MagicMock, mock_sentry_sdk: mock.MagicMock
    ) -> None:
        """A ConnectionRefusedError in the chain should halt, not fail."""
        root = ConnectionRefusedError("Connection refused")
        outer = RuntimeError("ApiError wrapping connection refusal")
        outer.__context__ = root

        metric_obj = self.TestLifecycleMetric()
        with pytest.raises(RuntimeError):
            with metric_obj.capture():
                raise outer

        assert mock_metrics.incr.call_args_list[-1][0][0] == "integrations.slo.halted"
        mock_sentry_sdk.capture_exception.assert_not_called()

    @mock.patch("sentry.integrations.utils.metrics.sentry_sdk")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_unrelated_exception_still_records_failure(
        self, mock_metrics: mock.MagicMock, mock_sentry_sdk: mock.MagicMock
    ) -> None:
        """Exceptions unrelated to connectivity must still create Sentry issues."""
        mock_sentry_sdk.capture_exception.return_value = "test-event-id"

        metric_obj = self.TestLifecycleMetric()
        with pytest.raises(ValueError):
            with metric_obj.capture():
                raise ValueError("unexpected internal error")

        assert mock_metrics.incr.call_args_list[-1][0][0] == "integrations.slo.failure"
        mock_sentry_sdk.capture_exception.assert_called_once()

    @mock.patch("sentry.integrations.utils.metrics.sentry_sdk")
    @mock.patch("sentry.integrations.utils.metrics.metrics")
    def test_restricted_ip_address_in_cause_records_halt(
        self, mock_metrics: mock.MagicMock, mock_sentry_sdk: mock.MagicMock
    ) -> None:
        """RestrictedIPAddress via explicit __cause__ still records a halt (existing behavior)."""
        inner = RestrictedIPAddress("blocked")
        outer = RuntimeError("ApiHostError: restricted")
        outer.__cause__ = inner  # explicit chaining

        metric_obj = self.TestLifecycleMetric()
        with pytest.raises(RuntimeError):
            with metric_obj.capture():
                raise outer

        assert mock_metrics.incr.call_args_list[-1][0][0] == "integrations.slo.halted"
        mock_sentry_sdk.capture_exception.assert_not_called()
