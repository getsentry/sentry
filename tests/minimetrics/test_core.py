from unittest.mock import patch

from minimetrics.core import CounterMetric, DistributionMetric, MiniMetricsClient, SetMetric
from sentry.testutils.helpers.datetime import freeze_time
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
    emit_args = list(_emit.call_args.args[0])
    assert len(emit_args) == 1
    assert emit_args[0][0] == 1693994400
    keys = list(emit_args[0][1].keys())
    assert keys == [
        (
            "c",
            "button_clicked",
            "nanosecond",
            (
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
    ]
    values = list(emit_args[0][1].values())
    assert isinstance(values[0], CounterMetric)
    assert list(values[0].serialize_value()) == [1]


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
    emit_args = list(_emit.call_args.args[0])
    assert len(emit_args) == 1
    assert emit_args[0][0] == 1693994400
    keys = list(emit_args[0][1].keys())
    assert keys == [
        (
            "d",
            "execution_time",
            "second",
            (
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
    ]
    values = list(emit_args[0][1].values())
    assert isinstance(values[0], DistributionMetric)
    assert list(values[0].serialize_value()) == [1.0]


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
    emit_args = list(_emit.call_args.args[0])
    assert len(emit_args) == 1
    assert emit_args[0][0] == 1693994400
    keys = list(emit_args[0][1].keys())
    assert keys == [
        (
            "s",
            "user",
            "none",
            (
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
    ]
    values = list(emit_args[0][1].values())
    assert isinstance(values[0], SetMetric)
    assert list(values[0].serialize_value()) == [3455635177]


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
    emit_args = list(_emit.call_args.args[0])
    assert len(emit_args) == 1
    assert emit_args[0][0] == 1693994400
    keys = list(emit_args[0][1].keys())
    assert keys == [
        (
            "c",
            "frontend_time",
            "second",
            (
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
    ]
    values = list(emit_args[0][1].values())
    assert isinstance(values[0], CounterMetric)
    assert list(values[0].serialize_value()) == [15.0]
