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


def test_rest_output_opts_into_user_identifiers() -> None:
    # the ?llmFormat response already carries `user` in full, so rendering those fields adds
    # nothing the caller can't read -- unlike the default list, which holds them back
    data = {"title": "t", "user": {"email": "someone@example.com", "ipAddress": "203.0.113.7"}}
    out = format_event_response(data, "markdown")
    assert "someone@example.com" in out
    assert "203.0.113.7" in out
