from typing import Any

from sentry.issues.formatting.mixin import format_event_response


def _event_with_request_body(body_chars: int) -> dict[str, Any]:
    return {
        "title": "t",
        "entries": [
            {
                "type": "request",
                "data": {"method": "POST", "url": "https://x.com", "data": "x" * body_chars},
            }
        ],
    }


def test_rest_output_uses_the_low_limits() -> None:
    # the ?llmFormat response is pasted into a model's context, so it renders with the tighter
    # profile rather than the default one the Seer RPC gets
    out = format_event_response(_event_with_request_body(5_000), "markdown")
    assert "... (truncated)" in out
    assert len(out) < 3_000  # max_request_chars=2_000, plus the surrounding section
