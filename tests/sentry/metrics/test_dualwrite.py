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


@mock.patch("sentry_sdk.metrics.count")
@mock.patch("datadog.dogstatsd.base.DogStatsd.increment")
@thread_leak_allowlist(reason="datadog dualwrite metrics", issue=98803)
def test_dualwrite_experimental_backend(dogstatsd_incr, sentry_sdk_incr):
    backend = DualWriteMetricsBackend(
        primary_backend="sentry.metrics.dogstatsd.DogStatsdMetricsBackend",
        experimental_backend="sentry.metrics.sentry_sdk.SentrySDKMetricsBackend",
        experimental_args={"deny_list": ["sentry.denied"], "experimental_sample_rate": 1.0},
    )

    backend.incr("allowed", tags={"test": "tag"}, unit="none")
    dogstatsd_incr.assert_called_once()
    sentry_sdk_incr.assert_called_once()

    dogstatsd_incr.reset_mock()
    sentry_sdk_incr.reset_mock()

    backend.incr("denied.metric", tags={"test": "tag"}, unit="none")
    dogstatsd_incr.assert_called_once()
    sentry_sdk_incr.assert_not_called()


@mock.patch("sentry_sdk.metrics.gauge")
@mock.patch("datadog.dogstatsd.base.DogStatsd.gauge")
@thread_leak_allowlist(reason="datadog dualwrite metrics", issue=98803)
def test_dualwrite_experimental_backend_rollout_disabled(dogstatsd_gauge, sentry_sdk_gauge):
    backend = DualWriteMetricsBackend(
        primary_backend="sentry.metrics.dogstatsd.DogStatsdMetricsBackend",
        experimental_backend="sentry.metrics.sentry_sdk.SentrySDKMetricsBackend",
        experimental_args={"deny_list": [], "experimental_sample_rate": 0.0},
    )

    backend.gauge("metric", 42, tags={"test": "tag"}, unit="none")
    dogstatsd_gauge.assert_called_once()
    sentry_sdk_gauge.assert_not_called()


@mock.patch("datadog.dogstatsd.base.DogStatsd.set")
@mock.patch("datadog.dogstatsd.base.statsd.set")
@thread_leak_allowlist(reason="datadog dualwrite metrics", issue=98803)
def test_dualwrite_set(primary_set, secondary_set):
    # Primary DogStatsdMetricsBackend uses the module-level statsd client;
    # PreciseDogStatsdMetricsBackend uses its own DogStatsd instance. Patch them
    # separately so routing to primary vs secondary is actually observable.
    backend = DualWriteMetricsBackend(
        primary_backend="sentry.metrics.dogstatsd.DogStatsdMetricsBackend",
        secondary_backend="sentry.metrics.precise_dogstatsd.PreciseDogStatsdMetricsBackend",
        secondary_prefixes=["secondary"],
    )

    backend.set("foo", 4242, tags={"some": "stuff"})
    primary_set.assert_called_once()
    secondary_set.assert_not_called()

    primary_set.reset_mock()
    secondary_set.reset_mock()

    backend.set("secondary.foo", 4242, tags={"some": "stuff"})
    primary_set.assert_not_called()
    secondary_set.assert_called_once()


@mock.patch("sentry.metrics.sentry_sdk.SentrySDKMetricsBackend.set")
@mock.patch("datadog.dogstatsd.base.statsd.set")
@thread_leak_allowlist(reason="datadog dualwrite metrics", issue=98803)
def test_dualwrite_set_experimental_backend(primary_set, experimental_set):
    # The experimental backend's set is patched directly (SentrySDK's set is a
    # no-op otherwise) so forwarding to the experimental backend is observable.
    backend = DualWriteMetricsBackend(
        primary_backend="sentry.metrics.dogstatsd.DogStatsdMetricsBackend",
        experimental_backend="sentry.metrics.sentry_sdk.SentrySDKMetricsBackend",
        experimental_args={"deny_list": [], "experimental_sample_rate": 1.0},
    )

    backend.set("allowed", 4242, tags={"test": "tag"})
    primary_set.assert_called_once()
    experimental_set.assert_called_once()
