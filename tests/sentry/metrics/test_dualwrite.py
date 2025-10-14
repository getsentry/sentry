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


@mock.patch("sentry.options.rollout.in_random_rollout", return_value=True)
@mock.patch("sentry_sdk.metrics.incr")
@mock.patch("datadog.dogstatsd.base.DogStatsd.increment")
@thread_leak_allowlist(reason="datadog dualwrite metrics", issue=98803)
def test_dualwrite_experimental_backend(dogstatsd_incr, sentry_sdk_incr, mock_rollout):
    backend = DualWriteMetricsBackend(
        primary_backend="sentry.metrics.dogstatsd.DogStatsdMetricsBackend",
        experimental_backend="sentry.metrics.sentry_sdk.SentrySDKMetricsBackend",
        experimental_args={"deny_list": ["denied"]},
    )

    backend.incr("allowed", tags={"test": "tag"}, unit="none")
    dogstatsd_incr.assert_called_once()
    sentry_sdk_incr.assert_called_once()

    dogstatsd_incr.reset_mock()
    sentry_sdk_incr.reset_mock()

    backend.incr("denied.metric", tags={"test": "tag"}, unit="none")
    dogstatsd_incr.assert_called_once()
    sentry_sdk_incr.assert_not_called()


@mock.patch("sentry.options.rollout.in_random_rollout", return_value=False)
@mock.patch("sentry_sdk.metrics.gauge")
@mock.patch("datadog.dogstatsd.base.DogStatsd.gauge")
@thread_leak_allowlist(reason="datadog dualwrite metrics", issue=98803)
def test_dualwrite_experimental_backend_rollout_disabled(
    dogstatsd_gauge, sentry_sdk_gauge, mock_rollout
):
    backend = DualWriteMetricsBackend(
        primary_backend="sentry.metrics.dogstatsd.DogStatsdMetricsBackend",
        experimental_backend="sentry.metrics.sentry_sdk.SentrySDKMetricsBackend",
        experimental_args={"deny_list": []},
    )

    backend.gauge("metric", 42, tags={"test": "tag"}, unit="none")
    dogstatsd_gauge.assert_called_once()
    sentry_sdk_gauge.assert_not_called()
