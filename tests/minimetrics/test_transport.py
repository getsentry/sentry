from minimetrics.transport import RelayStatsdEncoder


def test_relay_encoder_with_counter():
    encoder = RelayStatsdEncoder()

    metric_1 = {
        "type": "c",
        "name": "button_click",
        "value": 2,
        "timestamp": 1693994400,
        "width": 10,
    }
    result = encoder.encode(metric_1)
    assert result == "button_click:2|c"

    metric_2 = {
        **metric_1,
        "unit": "second",
        "tags": (
            ("browser", "Chrome"),
            ("browser.version", "1.0"),
        ),
    }
    result = encoder.encode(metric_2)  # type:ignore
    assert result == "button_click@second:2|c|#browser:Chrome,browser.version:1.0"


def test_relay_encoder_with_distribution():
    encoder = RelayStatsdEncoder()

    metric_1 = {
        "type": "d",
        "name": "execution_time",
        "value": [1.0, 0.5, 3.0],
        "timestamp": 1693994400,
        "width": 10,
    }
    result = encoder.encode(metric_1)
    assert result == "execution_time:1.0:0.5:3.0|d"

    metric_2 = {
        **metric_1,
        "unit": "second",
        "tags": (
            ("browser", "Chrome"),
            ("browser.version", "1.0"),
        ),
    }
    result = encoder.encode(metric_2)  # type:ignore
    assert result == "execution_time@second:1.0:0.5:3.0|d|#browser:Chrome,browser.version:1.0"
