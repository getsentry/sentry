from typing import cast

from sentry.spans.consumers.process_segments.shim import make_compatible
from sentry.spans.consumers.process_segments.types import TreeSpan
from tests.sentry.spans.consumers.process_segments.test_convert import SPAN_KAFKA_MESSAGE


def test_make_compatible():
    message = cast(TreeSpan, {**SPAN_KAFKA_MESSAGE, "sentry_tags": {"ignored": "tags"}})
    compatible = make_compatible(message)
    assert compatible["exclusive_time"] == message["exclusive_time_ms"]
    assert compatible["op"] == message["data"]["sentry.op"]

    # Pre-existing tags got overwritten:
    assert compatible["sentry_tags"] == {
        "description": "normalized_description",
        "environment": "development",
        "platform": "python",
        "release": "backend@24.7.0.dev0+c45b49caed1e5fcbf70097ab3f434b487c359b6b",
        "sdk.name": "sentry.python.django",
    }
