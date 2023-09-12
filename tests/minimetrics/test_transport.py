import pytest

from minimetrics.transport import EncodingError, RelayStatsdEncoder


def test_relay_encoder_with_counter():
    encoder = RelayStatsdEncoder()

    metric_1 = {
        "type": "c",
        "name": "button_click",
        "value": 2,
        "timestamp": 1693994400,
        "width": 10,
    }
    result = encoder.encode(metric_1)  # type:ignore
    assert result == "button_click:2|c|T1693994400"

    metric_2 = {
        **metric_1,
        "unit": "second",
        "tags": (
            ("browser", "Chrome"),
            ("browser.version", "1.0"),
        ),
    }
    result = encoder.encode(metric_2)  # type:ignore
    assert result == "button_click@second:2|c|#browser:Chrome,browser.version:1.0|T1693994400"


def test_relay_encoder_with_distribution():
    encoder = RelayStatsdEncoder()

    metric_1 = {
        "type": "d",
        "name": "execution_time",
        "value": [1.0, 0.5, 3.0],
        "timestamp": 1693994400,
        "width": 10,
    }
    result = encoder.encode(metric_1)  # type:ignore
    assert result == "execution_time:1.0:0.5:3.0|d|T1693994400"

    metric_2 = {
        **metric_1,
        "unit": "second",
        "tags": (
            ("browser", "Chrome"),
            ("browser.version", "1.0"),
        ),
    }
    result = encoder.encode(metric_2)  # type:ignore
    assert (
        result
        == "execution_time@second:1.0:0.5:3.0|d|#browser:Chrome,browser.version:1.0|T1693994400"
    )


def test_relay_encoder_with_set():
    encoder = RelayStatsdEncoder()

    metric_1 = {
        "type": "s",
        "name": "users",
        "value": [123, 456, 789],
        "timestamp": 1693994400,
        "width": 10,
    }
    result = encoder.encode(metric_1)  # type:ignore
    assert result == "users:123:456:789|s|T1693994400"

    metric_2 = {
        **metric_1,
        "unit": "none",
        "tags": (
            ("browser", "Chrome"),
            ("browser.version", "1.0"),
        ),
    }
    result = encoder.encode(metric_2)  # type:ignore
    assert result == "users@none:123:456:789|s|#browser:Chrome,browser.version:1.0|T1693994400"


def test_relay_encoder_with_gauge():
    encoder = RelayStatsdEncoder()

    metric_1 = {
        "type": "g",
        "name": "startup_time",
        "value": {
            "last": 10.0,
            "min": 1.0,
            "max": 20.0,
            "sum": 50.0,
            "count": 5,
        },
        "timestamp": 1693994400,
        "width": 10,
    }
    result = encoder.encode(metric_1)  # type:ignore
    assert result == "startup_time:10.0:1.0:20.0:50.0:5|g|T1693994400"

    metric_2 = {
        **metric_1,
        "unit": "second",
        "tags": (
            ("browser", "Chrome"),
            ("browser.version", "1.0"),
        ),
    }
    result = encoder.encode(metric_2)  # type:ignore
    assert (
        result
        == "startup_time@second:10.0:1.0:20.0:50.0:5|g|#browser:Chrome,browser.version:1.0|T1693994400"
    )


def test_relay_encoder_with_invalid_chars():
    encoder = RelayStatsdEncoder()

    metric_1 = {
        "type": "c",
        "name": "button_click",
        "value": 2,
        "timestamp": 1693994400,
        "width": 10,
        "unit": "second",
        "tags": (
            # Invalid tag key.
            ("browser\nname", "Chrome"),
            # Invalid tag value.
            ("browser.version", "\t1.\n0"),
            # Valid tag key and value.
            ("platform", "Android"),
        ),
    }
    result = encoder.encode(metric_1)  # type:ignore
    assert result == "button_click@second:2|c|#browser.version:1.0,platform:Android|T1693994400"

    metric_2 = {"type": "c", "name": "büttòn", "value": 2, "timestamp": 1693994400, "width": 10}
    with pytest.raises(EncodingError, match="The metric name is not valid"):
        encoder.encode(metric_2)  # type:ignore
