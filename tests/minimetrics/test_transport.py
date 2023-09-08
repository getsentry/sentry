from minimetrics.transport import RelayStatsdEncoder


def test_relay_encoder_with_counter():
    extracted_metric = {
        "type": "c",
        "name": "button_click",
        "value": 2,
        "timestamp": 1693994400,
        "width": 10,
    }

    encoder = RelayStatsdEncoder()
    result = encoder.encode(extracted_metric)

    assert result == "button_click:2|c"
