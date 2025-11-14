from typing import int
from unittest import mock

from sentry.metrics.precise_dogstatsd import PreciseDogStatsdMetricsBackend
from sentry.testutils.thread_leaks.pytest import thread_leak_allowlist


@thread_leak_allowlist(reason="datadog precise metrics", issue=98805)
@mock.patch("datadog.dogstatsd.base.DogStatsd.distribution")
def test_precise_distribution(distribution):
    backend = PreciseDogStatsdMetricsBackend(prefix="sentrytest.")

    backend.distribution("foo", 100, tags={"some": "stuff"}, unit="byte")
    distribution.assert_called_once()
    distribution.reset_mock()

    backend.timing("bar", 100, tags={"some": "stuff"})
    distribution.assert_called_once()
