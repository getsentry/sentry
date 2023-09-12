import pytest

from minimetrics.core import CounterMetric, DistributionMetric, GaugeMetric, SetMetric
from minimetrics.transport import EncodingError, RelayStatsdEncoder
from minimetrics.types import BucketKey, FlushedMetric


def test_relay_encoder_with_counter():
    encoder = RelayStatsdEncoder()

    bucket_key = BucketKey(
        timestamp=1693994400,
        metric_type="c",
        metric_name="button_click",
        metric_unit="none",
        metric_tags=(
            ("browser", "Chrome"),
            ("browser.version", "1.0"),
        ),
    )
    metric = CounterMetric(first=2)
    flushed_metric = FlushedMetric(bucket_key=bucket_key, metric=metric)

    result = encoder.encode(flushed_metric)
    assert result == "button_click@none:2|c|#browser:Chrome,browser.version:1.0|T1693994400"


def test_relay_encoder_with_distribution():
    encoder = RelayStatsdEncoder()

    bucket_key = BucketKey(
        timestamp=1693994400,
        metric_type="d",
        metric_name="execution_time",
        metric_unit="second",
        metric_tags=(
            ("browser", "Chrome"),
            ("browser.version", "1.0"),
        ),
    )
    metric = DistributionMetric(first=1.0)
    metric.add(0.5)
    metric.add(3.0)
    flushed_metric = FlushedMetric(bucket_key=bucket_key, metric=metric)

    result = encoder.encode(flushed_metric)
    assert (
        result
        == "execution_time@second:1.0:0.5:3.0|d|#browser:Chrome,browser.version:1.0|T1693994400"
    )


def test_relay_encoder_with_set():
    encoder = RelayStatsdEncoder()

    bucket_key = BucketKey(
        timestamp=1693994400,
        metric_type="s",
        metric_name="users",
        metric_unit="none",
        metric_tags=(
            ("browser", "Chrome"),
            ("browser.version", "1.0"),
        ),
    )
    metric = SetMetric(first=123)
    metric.add(456)
    metric.add("riccardo")
    flushed_metric = FlushedMetric(bucket_key=bucket_key, metric=metric)

    result = encoder.encode(flushed_metric)
    assert (
        result == "users@none:456:123:3455635177|s|#browser:Chrome,browser.version:1.0|T1693994400"
    )


def test_relay_encoder_with_gauge():
    encoder = RelayStatsdEncoder()

    bucket_key = BucketKey(
        timestamp=1693994400,
        metric_type="g",
        metric_name="startup_time",
        metric_unit="second",
        metric_tags=(
            ("browser", "Chrome"),
            ("browser.version", "1.0"),
        ),
    )
    metric = GaugeMetric(first=10.0)
    metric.add(5.0)
    metric.add(7.0)
    flushed_metric = FlushedMetric(bucket_key=bucket_key, metric=metric)

    result = encoder.encode(flushed_metric)
    assert (
        result
        == "startup_time@second:7.0:5.0:10.0:22.0:3|g|#browser:Chrome,browser.version:1.0|T1693994400"
    )


def test_relay_encoder_with_invalid_chars():
    encoder = RelayStatsdEncoder()

    bucket_key = BucketKey(
        timestamp=1693994400,
        metric_type="c",
        metric_name="büttòn_click",
        metric_unit="second",
        metric_tags=(
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
    flushed_metric = FlushedMetric(bucket_key=bucket_key, metric=metric)

    result = encoder.encode(flushed_metric)
    assert (
        result
        == "bttn_click@second:1|c|#browsername:Chrome,browser.version:1.0,platform:Android,version:|T1693994400"
    )

    bucket_key = BucketKey(
        timestamp=1693994400,
        metric_type="c",
        metric_name="üòë",
        metric_unit="second",
        metric_tags=(),
    )
    metric = CounterMetric(first=1)
    flushed_metric = FlushedMetric(bucket_key=bucket_key, metric=metric)

    with pytest.raises(EncodingError, match="The sanitized metric name is empty"):
        encoder.encode(flushed_metric)


def test_relay_encoder_with_multiple_metrics():
    encoder = RelayStatsdEncoder()

    flushed_metric_1 = FlushedMetric(
        bucket_key=BucketKey(
            timestamp=1693994400,
            metric_type="g",
            metric_name="startup_time",
            metric_unit="second",
            metric_tags=(
                ("browser", "Chrome"),
                ("browser.version", "1.0"),
            ),
        ),
        metric=GaugeMetric(first=10.0),
    )

    flushed_metric_2 = FlushedMetric(
        bucket_key=BucketKey(
            timestamp=1693994400,
            metric_type="c",
            metric_name="button_click",
            metric_unit="none",
            metric_tags=(
                ("browser", "Chrome"),
                ("browser.version", "1.0"),
            ),
        ),
        metric=CounterMetric(first=1),
    )

    result = encoder.encode_multiple([flushed_metric_1, flushed_metric_2])

    assert result == (
        "startup_time@second:10.0:10.0:10.0:10.0:1|g|#browser:Chrome,browser.version:1.0|T1693994400"
        + "\n"
        + "button_click@none:1|c|#browser:Chrome,browser.version:1.0|T1693994400"
    )
