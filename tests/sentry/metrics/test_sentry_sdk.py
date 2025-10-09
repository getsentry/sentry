from unittest import mock

import pytest

from sentry.metrics.sentry_sdk import SentrySDKMetricsBackend


class TestSentrySDKMetricsBackend:
    @pytest.fixture
    def backend(self):
        return SentrySDKMetricsBackend(prefix="test.")

    @mock.patch("sentry_sdk.metrics.incr")
    def test_incr(self, mock_incr, backend):
        backend.incr("foo", tags={"x": "y"}, amount=2, unit="count")

        mock_incr.assert_called_once_with(
            key="test.foo",
            value=2,
            unit="count",
            tags={"x": "y"},
        )

    @mock.patch("sentry_sdk.metrics.incr")
    def test_incr_no_unit(self, mock_incr, backend):
        backend.incr("foo", tags={"x": "y"}, amount=2)

        mock_incr.assert_called_once_with(
            key="test.foo",
            value=2,
            unit="none",
            tags={"x": "y"},
        )

    @mock.patch("sentry_sdk.metrics.gauge")
    def test_gauge(self, mock_gauge, backend):
        backend.gauge("bar", value=42.0, tags={"x": "y"}, unit="bytes")

        mock_gauge.assert_called_once_with(
            key="test.bar",
            value=42.0,
            unit="bytes",
            tags={"x": "y"},
        )

    @mock.patch("sentry_sdk.metrics.distribution")
    def test_distribution(self, mock_distribution, backend):
        backend.distribution("baz", value=100.0, tags={"x": "y"}, unit="millisecond")

        mock_distribution.assert_called_once_with(
            key="test.baz",
            value=100.0,
            unit="millisecond",
            tags={"x": "y"},
        )

    @mock.patch("sentry_sdk.metrics.incr")
    def test_incr_with_instance(self, mock_incr, backend):
        backend.incr("foo", instance="web", tags={"x": "y"}, amount=1)

        mock_incr.assert_called_once_with(
            key="test.foo",
            value=1,
            unit="none",
            tags={"x": "y", "instance": "web"},
        )

    def test_timing_noop(self, backend):
        backend.timing("foo", 42.0)

    def test_event_noop(self, backend):
        backend.event("title", "message")

    @mock.patch("sentry_sdk.metrics.incr")
    def test_incr_sampling(self, mock_incr, backend):
        with mock.patch.object(backend, "_should_sample", return_value=False):
            backend.incr("foo", amount=1)

        mock_incr.assert_not_called()
