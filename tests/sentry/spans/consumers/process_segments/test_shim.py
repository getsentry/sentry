from sentry.spans.consumers.process_segments.shim import make_compatible
from tests.sentry.spans.consumers.process_segments.test_convert import SPAN_KAFKA_MESSAGE


def test_make_compatible():
    message = {**SPAN_KAFKA_MESSAGE}
    message["attributes"] = {
        "sentry.exclusive_time_ms": {"type": "float", "value": 100.0},
        **message["attributes"],
    }
    compatible = make_compatible(message)
    assert compatible["exclusive_time"] == 100.0
    assert compatible["op"] == message["attributes"]["sentry.op"]["value"]

    # Pre-existing tags got overwritten:
    assert compatible["sentry_tags"] == {
        "description": "normalized_description",
        "environment": "development",
        "platform": "python",
        "release": "backend@24.7.0.dev0+c45b49caed1e5fcbf70097ab3f434b487c359b6b",
        "sdk.name": "sentry.python.django",
    }
