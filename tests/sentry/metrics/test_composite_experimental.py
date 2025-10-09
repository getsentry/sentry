from unittest import mock

import pytest

from sentry.metrics.composite_experimental import CompositeExperimentalMetricsBackend
from sentry.testutils.helpers import override_options


class TestCompositeExperimentalMetricsBackend:
    @pytest.fixture
    def backend(self):
        return CompositeExperimentalMetricsBackend(
            primary_backend="sentry.metrics.dummy.DummyMetricsBackend"
        )

    def test_incr_primary_only(self, backend):
        with mock.patch.object(backend._primary_backend, "incr") as mock_primary:
            with mock.patch.object(backend._sentry_sdk_backend, "incr") as mock_sdk:
                with mock.patch.object(backend, "_should_send_to_sentry_sdk", return_value=False):
                    backend.incr("foo", amount=1)

                mock_primary.assert_called_once_with("foo", None, None, 1, 1, None)
                mock_sdk.assert_not_called()

    @override_options({"tracemetrics.sentry_sdk_metrics_backend_rate": 1.0})
    def test_incr_both_backends(self, backend):
        with mock.patch.object(backend._primary_backend, "incr") as mock_primary:
            with mock.patch.object(backend._sentry_sdk_backend, "incr") as mock_sdk:
                with mock.patch.object(backend, "_should_send_to_sentry_sdk", return_value=True):
                    backend.incr("foo", amount=1, tags={"x": "y"})

                mock_primary.assert_called_once_with("foo", None, {"x": "y"}, 1, 1, None)
                mock_sdk.assert_called_once_with("foo", None, {"x": "y"}, 1, 1, None, stacklevel=1)

    def test_gauge_primary_only(self, backend):
        with mock.patch.object(backend._primary_backend, "gauge") as mock_primary:
            with mock.patch.object(backend._sentry_sdk_backend, "gauge") as mock_sdk:
                with mock.patch.object(backend, "_should_send_to_sentry_sdk", return_value=False):
                    backend.gauge("bar", value=42.0)

                mock_primary.assert_called_once_with("bar", 42.0, None, None, 1, None)
                mock_sdk.assert_not_called()

    @override_options({"tracemetrics.sentry_sdk_metrics_backend_rate": 1.0})
    def test_gauge_both_backends(self, backend):
        with mock.patch.object(backend._primary_backend, "gauge") as mock_primary:
            with mock.patch.object(backend._sentry_sdk_backend, "gauge") as mock_sdk:
                with mock.patch.object(backend, "_should_send_to_sentry_sdk", return_value=True):
                    backend.gauge("bar", value=42.0, unit="bytes")

                mock_primary.assert_called_once_with("bar", 42.0, None, None, 1, "bytes")
                mock_sdk.assert_called_once_with("bar", 42.0, None, None, 1, "bytes", stacklevel=1)

    def test_distribution_primary_only(self, backend):
        with mock.patch.object(backend._primary_backend, "distribution") as mock_primary:
            with mock.patch.object(backend._sentry_sdk_backend, "distribution") as mock_sdk:
                with mock.patch.object(backend, "_should_send_to_sentry_sdk", return_value=False):
                    backend.distribution("baz", value=100.0)

                mock_primary.assert_called_once_with("baz", 100.0, None, None, 1, None)
                mock_sdk.assert_not_called()

    def test_timing_primary_only(self, backend):
        with mock.patch.object(backend._primary_backend, "timing") as mock_primary:
            backend.timing("timing_key", value=50.0)

            mock_primary.assert_called_once_with("timing_key", 50.0, None, None, 1)

    def test_event_primary_only(self, backend):
        with mock.patch.object(backend._primary_backend, "event") as mock_primary:
            backend.event("title", "message")

            mock_primary.assert_called_once_with(
                "title", "message", None, None, None, None, None, None, 1
            )

    def test_denied_prefix(self, backend):
        backend._deny_prefixes = ("denied.",)

        with mock.patch.object(backend._sentry_sdk_backend, "incr") as mock_sdk:
            backend.incr("denied.metric", amount=1)
            mock_sdk.assert_not_called()

    @override_options({"tracemetrics.sentry_sdk_metrics_backend_rate": 0.0})
    def test_zero_sample_rate(self, backend):
        with mock.patch.object(backend._sentry_sdk_backend, "incr") as mock_sdk:
            backend.incr("foo", amount=1)
            mock_sdk.assert_not_called()

    @override_options({"tracemetrics.sentry_sdk_metrics_backend_rate": 1.0})
    def test_should_send_to_sentry_sdk(self, backend):
        with mock.patch("sentry.utils.options.sample_modulo", return_value=True):
            assert backend._should_send_to_sentry_sdk("test.metric") is True

        with mock.patch("sentry.utils.options.sample_modulo", return_value=False):
            assert backend._should_send_to_sentry_sdk("test.metric") is False
