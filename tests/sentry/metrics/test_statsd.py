from unittest.mock import patch

import pytest

from sentry.metrics.statsd import StatsdMetricsBackend


@pytest.fixture(scope="module")
def statsd_backend():
    backend = StatsdMetricsBackend(prefix="sentrytest.")
    try:
        yield backend
    finally:
        # XXX: this socket is never closed so we close it to prevent ResourceWarning
        backend.client._sock.close()


@patch("statsd.StatsClient.incr")
def test_incr(mock_incr, statsd_backend):
    statsd_backend.incr("foo")
    mock_incr.assert_called_once_with("sentrytest.foo", 1, 1)


@patch("statsd.StatsClient.timing")
def test_timing(mock_timing, statsd_backend):
    statsd_backend.timing("foo", 30)
    mock_timing.assert_called_once_with("sentrytest.foo", 30, 1)


@patch("statsd.StatsClient.gauge")
def test_gauge(mock_gauge, statsd_backend):
    statsd_backend.gauge("foo", 5)
    mock_gauge.assert_called_once_with("sentrytest.foo", 5, 1)
