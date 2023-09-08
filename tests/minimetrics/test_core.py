from unittest.mock import patch

from freezegun import freeze_time

from minimetrics import MiniMetricsClient
from minimetrics.core import BucketKey, CounterMetric, DistributionMetric, GaugeMetric, SetMetric


def test_simple():
    client = MiniMetricsClient()
    client.incr("button_clicked", 1.0)
    client.aggregator.stop()

    assert len(client.aggregator.buckets) == 0


@freeze_time("2023-09-06 10:00:00")
@patch("minimetrics.core.Aggregator._emit")
def test_client_incr(_emit):
    tags = {
        "browser": "Chrome",
        "browser.version": "1.0",
        "user.orgs": ["sentry", "google", "apple"],
        "user.classes": ["1", "2", "3"],
    }
    client = MiniMetricsClient()
    client.incr("button_clicked", 1.0, tags=tags)  # type:ignore
    client.aggregator.stop()

    assert len(client.aggregator.buckets) == 0
    extracted_metrics_arg = _emit.call_args.args[0]
    assert len(extracted_metrics_arg) == 1
    assert extracted_metrics_arg[0][0] == BucketKey(
        timestamp=1693994400,
        metric_type="c",
        metric_key="button_clicked",
        metric_unit="nanosecond",
        metric_tags=(
            ("browser", "Chrome"),
            ("browser.version", "1.0"),
            ("user.classes", "1"),
            ("user.classes", "2"),
            ("user.classes", "3"),
            ("user.orgs", "apple"),
            ("user.orgs", "google"),
            ("user.orgs", "sentry"),
        ),
    )
    assert isinstance(extracted_metrics_arg[0][1], CounterMetric)
    assert extracted_metrics_arg[0][1].serialize_value() == 1


@freeze_time("2023-09-06 10:00:00")
@patch("minimetrics.core.Aggregator._emit")
def test_client_timing(_emit):
    tags = {
        "browser": "Chrome",
        "browser.version": "1.0",
        "user.orgs": ["sentry", "google", "apple"],
        "user.classes": ["1", "2", "3"],
    }
    client = MiniMetricsClient()
    client.timing("execution_time", 1.0, tags=tags)  # type:ignore
    client.aggregator.stop()

    assert len(client.aggregator.buckets) == 0
    extracted_metrics_arg = _emit.call_args.args[0]
    assert len(extracted_metrics_arg) == 1
    assert extracted_metrics_arg[0][0] == BucketKey(
        timestamp=1693994400,
        metric_type="d",
        metric_key="execution_time",
        metric_unit="second",
        metric_tags=(
            ("browser", "Chrome"),
            ("browser.version", "1.0"),
            ("user.classes", "1"),
            ("user.classes", "2"),
            ("user.classes", "3"),
            ("user.orgs", "apple"),
            ("user.orgs", "google"),
            ("user.orgs", "sentry"),
        ),
    )
    assert isinstance(extracted_metrics_arg[0][1], DistributionMetric)
    assert extracted_metrics_arg[0][1].serialize_value() == [1.0]
    assert len(client.aggregator.buckets) == 0


@freeze_time("2023-09-06 10:00:00")
@patch("minimetrics.core.Aggregator._emit")
def test_client_set(_emit):
    tags = {
        "browser": "Chrome",
        "browser.version": "1.0",
        "user.orgs": ["sentry", "google", "apple"],
        "user.classes": ["1", "2", "3"],
    }
    client = MiniMetricsClient()
    client.set("user", "riccardo", tags=tags)  # type:ignore
    client.aggregator.stop()

    assert len(client.aggregator.buckets) == 0
    extracted_metrics_arg = _emit.call_args.args[0]
    assert len(extracted_metrics_arg) == 1
    assert extracted_metrics_arg[0][0] == BucketKey(
        timestamp=1693994400,
        metric_type="s",
        metric_key="user",
        metric_unit=None,
        metric_tags=(
            ("browser", "Chrome"),
            ("browser.version", "1.0"),
            ("user.classes", "1"),
            ("user.classes", "2"),
            ("user.classes", "3"),
            ("user.orgs", "apple"),
            ("user.orgs", "google"),
            ("user.orgs", "sentry"),
        ),
    )
    assert isinstance(extracted_metrics_arg[0][1], SetMetric)
    assert extracted_metrics_arg[0][1].serialize_value() == [3455635177]
    assert len(client.aggregator.buckets) == 0


@freeze_time("2023-09-06 10:00:00")
@patch("minimetrics.core.Aggregator._emit")
def test_client_gauge(_emit):
    tags = {
        "browser": "Chrome",
        "browser.version": "1.0",
        "user.orgs": ["sentry", "google", "apple"],
        "user.classes": ["1", "2", "3"],
    }
    client = MiniMetricsClient()
    client.gauge("frontend_time", 15.0, tags=tags)  # type:ignore
    client.aggregator.stop()

    assert len(client.aggregator.buckets) == 0
    extracted_metrics_arg = _emit.call_args.args[0]
    assert len(extracted_metrics_arg) == 1
    assert extracted_metrics_arg[0][0] == BucketKey(
        timestamp=1693994400,
        metric_type="g",
        metric_key="frontend_time",
        metric_unit="second",
        metric_tags=(
            ("browser", "Chrome"),
            ("browser.version", "1.0"),
            ("user.classes", "1"),
            ("user.classes", "2"),
            ("user.classes", "3"),
            ("user.orgs", "apple"),
            ("user.orgs", "google"),
            ("user.orgs", "sentry"),
        ),
    )
    assert isinstance(extracted_metrics_arg[0][1], GaugeMetric)
    assert extracted_metrics_arg[0][1].serialize_value() == {
        "last": 15.0,
        "min": 15.0,
        "max": 15.0,
        "sum": 15.0,
        "count": 1,
    }
    assert len(client.aggregator.buckets) == 0
