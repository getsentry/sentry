from unittest import mock

from sentry.metrics.dualwrite import DualWriteMetricsBackend
from sentry.testutils.thread_leaks.pytest import thread_leak_allowlist


@mock.patch("datadog.threadstats.base.ThreadStats.timing")
@mock.patch("datadog.dogstatsd.base.DogStatsd.distribution")
@thread_leak_allowlist(reason="datadog dualwrite metrics", issue=98803)
def test_dualwrite_distribution(distribution, timing):
    backend = DualWriteMetricsBackend(
        primary_backend="sentry.metrics.datadog.DatadogMetricsBackend",
        secondary_backend="sentry.metrics.precise_dogstatsd.PreciseDogStatsdMetricsBackend",
        distribution_prefixes=["foo"],
    )

    backend.distribution("foo", 100, tags={"some": "stuff"}, unit="byte")
    # datadog treats distributions as timing
    timing.assert_called_once()
    distribution.assert_called_once()

    timing.reset_mock()
    distribution.reset_mock()

    backend.timing("foo", 100, tags={"some": "stuff"})
    # precise datadog treats timing as distribution
    timing.assert_called_once()
    distribution.assert_called_once()

    timing.reset_mock()
    distribution.reset_mock()

    backend.timing("bar", 100, tags={"some": "stuff"})
    timing.assert_called_once()
    distribution.assert_not_called()
