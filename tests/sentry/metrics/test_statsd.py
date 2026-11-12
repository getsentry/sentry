from collections.abc import Generator
from unittest.mock import MagicMock, patch

import pytest

from sentry.metrics.statsd import StatsdMetricsBackend


@pytest.fixture(scope="module")
def statsd_backend() -> Generator[StatsdMetricsBackend]:
    backend = StatsdMetricsBackend(prefix="sentrytest.")
    try:
        yield backend
    finally:
        # XXX: this socket is never closed, so we close it to prevent ResourceWarning
        backend.client._sock.close()


@patch("statsd.StatsClient.incr")
def test_incr(mock_incr: MagicMock, statsd_backend: StatsdMetricsBackend) -> None:
    statsd_backend.incr("foo")
    mock_incr.assert_called_once_with("sentrytest.foo", 1, 1)


@patch("statsd.StatsClient.timing")
def test_timing(mock_timing: MagicMock, statsd_backend: StatsdMetricsBackend) -> None:
    statsd_backend.timing("foo", 30)
    mock_timing.assert_called_once_with("sentrytest.foo", 30, 1)


@patch("statsd.StatsClient.gauge")
def test_gauge(mock_gauge: MagicMock, statsd_backend: StatsdMetricsBackend) -> None:
    statsd_backend.gauge("foo", 5)
    mock_gauge.assert_called_once_with("sentrytest.foo", 5, 1)


@patch("statsd.StatsClient.set")
def test_set(mock_set: MagicMock, statsd_backend: StatsdMetricsBackend) -> None:
    statsd_backend.set("foo", 4242)
    mock_set.assert_called_once_with("sentrytest.foo", 4242, 1)
