from typing import Any
from unittest.mock import patch

from minimetrics.core import CounterMetric, DistributionMetric, GaugeMetric, SetMetric
from minimetrics.transport import MetricEnvelopeTransport, RelayStatsdEncoder
from minimetrics.types import BucketKey


def test_relay_encoder_with_counter():
    encoder = RelayStatsdEncoder()

    bucket_key: BucketKey = (
        1693994400,
        "c",
        "button_click",
        "none",
        (
            ("browser", "Chrome"),
            ("browser.version", "1.0"),
        ),
    )
    metric = CounterMetric(first=2)
    flushed_metric = (bucket_key, metric)

    result = encoder.encode(flushed_metric)
    assert result == "button_click@none:2|c|#browser:Chrome,browser.version:1.0|T1693994400"


def test_relay_encoder_with_distribution():
    encoder = RelayStatsdEncoder()

    bucket_key: BucketKey = (
        1693994400,
        "d",
        "execution_time",
        "second",
        (
            ("browser", "Chrome"),
            ("browser.version", "1.0"),
        ),
    )
    metric = DistributionMetric(first=1.0)
    metric.add(0.5)
    metric.add(3.0)
    flushed_metric = (bucket_key, metric)

    result = encoder.encode(flushed_metric)
    assert (
        result
        == "execution_time@second:1.0:0.5:3.0|d|#browser:Chrome,browser.version:1.0|T1693994400"
    )


def test_relay_encoder_with_set():
    encoder = RelayStatsdEncoder()

    bucket_key: BucketKey = (
        1693994400,
        "s",
        "users",
        "none",
        (
            ("browser", "Chrome"),
            ("browser.version", "1.0"),
        ),
    )
    metric = SetMetric(first=123)
    metric.add(456)
    metric.add("riccardo")
    flushed_metric = (bucket_key, metric)

    result = encoder.encode(flushed_metric)
    pieces = result.split("|")

    m = pieces[0].split(":")
    assert m[0] == "users@none"
    assert sorted(m[1:]) == sorted(["123", "456", "3455635177"])

    assert pieces[1] == "s"
    assert pieces[2] == "#browser:Chrome,browser.version:1.0"
    assert pieces[3] == "T1693994400"


def test_relay_encoder_with_gauge():
    encoder = RelayStatsdEncoder()

    bucket_key: BucketKey = (
        1693994400,
        "g",
        "startup_time",
        "second",
        (
            ("browser", "Chrome"),
            ("browser.version", "1.0"),
        ),
    )
    metric = GaugeMetric(first=10.0)
    metric.add(5.0)
    metric.add(7.0)
    flushed_metric = (bucket_key, metric)

    result = encoder.encode(flushed_metric)
    assert (
        result
        == "startup_time@second:7.0:5.0:10.0:22.0:3|g|#browser:Chrome,browser.version:1.0|T1693994400"
    )


def test_relay_encoder_with_invalid_chars():
    encoder = RelayStatsdEncoder()

    bucket_key: BucketKey = (
        1693994400,
        "c",
        "büttòn_click",
        "second",
        (
            # Invalid tag key.
            ("browser\nname", "Chrome"),
            # Invalid tag value.
            ("browser.version", "\t1.\n0ô"),
            # Valid tag key and value.
            ("platform", "Android"),
            # Totally invalid tag key.
            ("\nöś", "Windows"),
            # Totally invalid tag value.
            ("version", "\n\t"),
        ),
    )
    metric = CounterMetric(first=1)
    flushed_metric = (bucket_key, metric)

    result = encoder.encode(flushed_metric)
    assert (
        result
        == "bttn_click@second:1|c|#browsername:Chrome,browser.version:1.0,platform:Android,version:|T1693994400"
    )

    bucket_key = (
        1693994400,
        "c",
        "üòë",
        "second",
        (),
    )
    metric = CounterMetric(first=1)
    flushed_metric = (bucket_key, metric)

    assert encoder.encode(flushed_metric) == "invalid-metric-name@second:1|c|T1693994400"


def test_relay_encoder_with_multiple_metrics():
    encoder = RelayStatsdEncoder()

    flushed_metric_1 = (
        (
            1693994400,
            "g",
            "startup_time",
            "second",
            (
                ("browser", "Chrome"),
                ("browser.version", "1.0"),
            ),
        ),
        GaugeMetric(first=10.0),
    )

    flushed_metric_2 = (
        (
            1693994400,
            "c",
            "button_click",
            "none",
            (
                ("browser", "Chrome"),
                ("browser.version", "1.0"),
            ),
        ),
        CounterMetric(first=1),
    )

    flushed_metric_3 = (
        (
            1693994400,
            "c",
            # This name will be completely scraped, resulting in an invalid metric.
            "öüâ",
            "none",
            (
                ("browser", "Chrome"),
                ("browser.version", "1.0"),
            ),
        ),
        CounterMetric(first=1),
    )

    metrics: Any = [flushed_metric_1, flushed_metric_2, flushed_metric_3]
    result = encoder.encode_multiple(metrics)

    assert result == (
        "startup_time@second:10.0:10.0:10.0:10.0:1|g|#browser:Chrome,browser.version:1.0|T1693994400"
        + "\n"
        + "button_click@none:1|c|#browser:Chrome,browser.version:1.0|T1693994400"
        + "\n"
        + "invalid-metric-name@none:1|c|#browser:Chrome,browser.version:1.0|T1693994400"
    )


@patch("minimetrics.transport.sentry_sdk")
def test_send(sentry_sdk):
    flushed_metric = (
        (
            1693994400,
            "c",
            "button_click",
            "none",
            (
                ("browser", "Chrome"),
                ("browser.version", "1.0"),
            ),
        ),
        CounterMetric(first=1),
    )

    transport = MetricEnvelopeTransport(RelayStatsdEncoder())
    metrics: Any = [flushed_metric]
    transport.send(metrics)

    args = sentry_sdk.Hub.current.client.transport.capture_envelope.call_args.args
    assert len(args) == 1
    arg = args[0]
    assert arg.items[0].type == "statsd"
    assert arg.items[0].data_category == "statsd"
