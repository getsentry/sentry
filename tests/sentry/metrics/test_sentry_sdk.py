from unittest import mock

import pytest

from sentry.metrics.sentry_sdk import SentrySDKMetricsBackend


class TestSentrySDKMetricsBackend:
    @pytest.fixture
    def backend(self):
        return SentrySDKMetricsBackend(prefix="test.", experimental_sample_rate=1.0)

    @mock.patch("sentry_sdk._metrics.count")
    def test_incr(self, mock_count, backend):
        with mock.patch.object(backend, "_should_send", return_value=True):
            backend.incr("foo", tags={"x": "y"}, amount=2, unit="count")

        mock_count.assert_called_once_with(
            "test.foo",
            2,
            unit="count",
            attributes={"x": "y"},
        )

    @mock.patch("sentry_sdk._metrics.count")
    def test_incr_no_unit(self, mock_count, backend):
        with mock.patch.object(backend, "_should_send", return_value=True):
            backend.incr("foo", tags={"x": "y"}, amount=2)

        mock_count.assert_called_once_with(
            "test.foo",
            2,
            unit=None,
            attributes={"x": "y"},
        )

    @mock.patch("sentry_sdk._metrics.gauge")
    def test_gauge(self, mock_gauge, backend):
        with mock.patch.object(backend, "_should_send", return_value=True):
            backend.gauge("bar", value=42.0, tags={"x": "y"}, unit="bytes")

        mock_gauge.assert_called_once_with(
            "test.bar",
            42.0,
            unit="bytes",
            attributes={"x": "y"},
        )

    @mock.patch("sentry_sdk._metrics.distribution")
    def test_distribution(self, mock_distribution, backend):
        with mock.patch.object(backend, "_should_send", return_value=True):
            backend.distribution("baz", value=100.0, tags={"x": "y"}, unit="millisecond")

        mock_distribution.assert_called_once_with(
            "test.baz",
            100.0,
            unit="millisecond",
            attributes={"x": "y"},
        )

    @mock.patch("sentry_sdk._metrics.count")
    def test_incr_with_instance(self, mock_count, backend):
        with mock.patch.object(backend, "_should_send", return_value=True):
            backend.incr("foo", instance="web", tags={"x": "y"}, amount=1)

        mock_count.assert_called_once_with(
            "test.foo",
            1,
            unit=None,
            attributes={"x": "y", "instance": "web"},
        )

    def test_timing_noop(self, backend):
        backend.timing("foo", 42.0)

    def test_event_noop(self, backend):
        backend.event("title", "message")

    @mock.patch("sentry_sdk._metrics.count")
    def test_incr_sampling(self, mock_count):
        backend = SentrySDKMetricsBackend(prefix="test.", experimental_sample_rate=0.0)
        backend.incr("foo", amount=1)
        mock_count.assert_not_called()

    @mock.patch("sentry_sdk._metrics.count")
    def test_incr_deny_list(self, mock_count):
        backend = SentrySDKMetricsBackend(
            prefix="test.", experimental_sample_rate=1.0, deny_list=["denied"]
        )
        backend.incr("denied.metric", amount=1)
        mock_count.assert_not_called()

        backend.incr("allowed.metric", amount=1)
        mock_count.assert_called_once()
