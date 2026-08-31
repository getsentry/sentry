from typing import Any, cast

from rest_framework.request import Request

from sentry.issues.formatting.mixin import (
    FORMATTER_FEATURE,
    FORMATTER_FEATURE_API,
    format_event_response,
    formatter_feature_for,
)


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


class _FakeRequest:
    def __init__(self, auth: object) -> None:
        self.auth = auth


def test_ui_and_api_callers_check_different_features() -> None:
    assert formatter_feature_for(cast(Request, _FakeRequest(None))) == FORMATTER_FEATURE
    assert formatter_feature_for(cast(Request, _FakeRequest(object()))) == FORMATTER_FEATURE_API
