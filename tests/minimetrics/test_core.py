from unittest.mock import patch

from freezegun import freeze_time

from minimetrics import MiniMetricsClient


@freeze_time("2023-09-06 10:00:00")
@patch("minimetrics.core.Aggregator._emit")
def test_client_incr(_emit):
    tags = {
        "browser": "Chrome",
        "browser.version": 1.0,
        "user.orgs": ["sentry", "google", "apple"],
        "user.classes": [1, 2, 3],
    }
    client = MiniMetricsClient()
    client.incr("button_clicked", 1.0, tags=tags)  # type:ignore
    client.aggregator.stop()

    assert len(client.aggregator.buckets) == 0
    _emit.assert_called_with(
        [
            (
                {
                    "type": "c",
                    "name": "button_clicked",
                    "value": 1.0,
                    "timestamp": 1693994400,
                    "width": 10,
                    "unit": "nanosecond",
                    "tags": (
                        ("browser", "Chrome"),
                        ("browser.version", 1.0),
                        ("user.classes", 1),
                        ("user.classes", 2),
                        ("user.classes", 3),
                        ("user.orgs", "apple"),
                        ("user.orgs", "google"),
                        ("user.orgs", "sentry"),
                    ),
                },
                1,
            )
        ],
        True,
    )


@freeze_time("2023-09-06 10:00:00")
@patch("minimetrics.core.Aggregator._emit")
def test_client_timing(_emit):
    tags = {
        "browser": "Chrome",
        "browser.version": 1.0,
        "user.orgs": ["sentry", "google", "apple"],
        "user.classes": [1, 2, 3],
    }
    client = MiniMetricsClient()
    client.timing("execution_time", 1.0, tags=tags)  # type:ignore
    client.aggregator.stop()

    assert len(client.aggregator.buckets) == 0
    _emit.assert_called_with(
        [
            (
                {
                    "type": "d",
                    "name": "execution_time",
                    "value": [1.0],
                    "timestamp": 1693994400,
                    "width": 10,
                    "unit": "second",
                    "tags": (
                        ("browser", "Chrome"),
                        ("browser.version", 1.0),
                        ("user.classes", 1),
                        ("user.classes", 2),
                        ("user.classes", 3),
                        ("user.orgs", "apple"),
                        ("user.orgs", "google"),
                        ("user.orgs", "sentry"),
                    ),
                },
                1,
            )
        ],
        True,
    )


@freeze_time("2023-09-06 10:00:00")
@patch("minimetrics.core.Aggregator._emit")
def test_client_set(_emit):
    tags = {
        "browser": "Chrome",
        "browser.version": 1.0,
        "user.orgs": ["sentry", "google", "apple"],
        "user.classes": [1, 2, 3],
    }
    client = MiniMetricsClient()
    client.set("user", "riccardo", tags=tags)  # type:ignore
    client.aggregator.stop()

    assert len(client.aggregator.buckets) == 0
    _emit.assert_called_with(
        [
            (
                {
                    "type": "s",
                    "name": "user",
                    "value": [3455635177],
                    "timestamp": 1693994400,
                    "width": 10,
                    "tags": (
                        ("browser", "Chrome"),
                        ("browser.version", 1.0),
                        ("user.classes", 1),
                        ("user.classes", 2),
                        ("user.classes", 3),
                        ("user.orgs", "apple"),
                        ("user.orgs", "google"),
                        ("user.orgs", "sentry"),
                    ),
                },
                1,
            )
        ],
        True,
    )


@freeze_time("2023-09-06 10:00:00")
@patch("minimetrics.core.Aggregator._emit")
def test_client_gauge(_emit):
    tags = {
        "browser": "Chrome",
        "browser.version": 1.0,
        "user.orgs": ["sentry", "google", "apple"],
        "user.classes": [1, 2, 3],
    }
    client = MiniMetricsClient()
    client.gauge("frontend_time", 15.0, tags=tags)  # type:ignore
    client.aggregator.stop()

    assert len(client.aggregator.buckets) == 0
    _emit.assert_called_with(
        [
            (
                {
                    "type": "g",
                    "name": "frontend_time",
                    "value": 15.0,
                    "timestamp": 1693994400,
                    "width": 10,
                    "unit": "second",
                    "tags": (
                        ("browser", "Chrome"),
                        ("browser.version", 1.0),
                        ("user.classes", 1),
                        ("user.classes", 2),
                        ("user.classes", 3),
                        ("user.orgs", "apple"),
                        ("user.orgs", "google"),
                        ("user.orgs", "sentry"),
                    ),
                },
                1,
            )
        ],
        True,
    )
