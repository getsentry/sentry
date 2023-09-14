from unittest.mock import patch

from freezegun import freeze_time

from minimetrics.core import CounterMetric, DistributionMetric, MiniMetricsClient, SetMetric
from minimetrics.types import BucketKey
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all
def test_envelope_forwarding():
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
        metric_name="button_clicked",
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
    assert list(extracted_metrics_arg[0][1].serialize_value()) == [1]


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
        metric_name="execution_time",
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
    assert list(extracted_metrics_arg[0][1].serialize_value()) == [1.0]
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
        metric_name="user",
        metric_unit="none",
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
    assert list(extracted_metrics_arg[0][1].serialize_value()) == [3455635177]
    assert len(client.aggregator.buckets) == 0


@freeze_time("2023-09-06 10:00:00")
@patch("minimetrics.core.Aggregator._emit")
def test_client_gauge_as_counter(_emit):
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
        metric_type="c",
        metric_name="frontend_time",
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
    assert isinstance(extracted_metrics_arg[0][1], CounterMetric)
    assert list(extracted_metrics_arg[0][1].serialize_value()) == [15.0]
    assert len(client.aggregator.buckets) == 0


# @freeze_time("2023-09-06 10:00:00")
# @patch("minimetrics.core.Aggregator._emit")
# def test_client_gauge(_emit):
#     tags = {
#         "browser": "Chrome",
#         "browser.version": "1.0",
#         "user.orgs": ["sentry", "google", "apple"],
#         "user.classes": ["1", "2", "3"],
#     }
#     client = MiniMetricsClient()
#     client.gauge("frontend_time", 15.0, tags=tags)  # type:ignore
#     client.aggregator.stop()
#
#     assert len(client.aggregator.buckets) == 0
#     extracted_metrics_arg = _emit.call_args.args[0]
#     assert len(extracted_metrics_arg) == 1
#     assert extracted_metrics_arg[0][0] == BucketKey(
#         timestamp=1693994400,
#         metric_type="g",
#         metric_name="frontend_time",
#         metric_unit="second",
#         metric_tags=(
#             ("browser", "Chrome"),
#             ("browser.version", "1.0"),
#             ("user.classes", "1"),
#             ("user.classes", "2"),
#             ("user.classes", "3"),
#             ("user.orgs", "apple"),
#             ("user.orgs", "google"),
#             ("user.orgs", "sentry"),
#         ),
#     )
#     assert isinstance(extracted_metrics_arg[0][1], GaugeMetric)
#     assert extracted_metrics_arg[0][1].serialize_value() == {
#         "last": 15.0,
#         "min": 15.0,
#         "max": 15.0,
#         "sum": 15.0,
#         "count": 1,
#     }
#     assert len(client.aggregator.buckets) == 0
