from typing import Any, cast

from rest_framework.request import Request

from sentry.issues.formatting.mixin import (
    _SECTIONS_BY_CONSUMER,
    FORMATTER_FEATURE,
    FORMATTER_FEATURE_API,
    consumer_for,
    format_event_response,
    formatter_feature_for,
)
from sentry.issues.formatting.sections import breadcrumbs_section


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


def _event_with_breadcrumbs() -> dict[str, Any]:
    return {
        "title": "t",
        "entries": [
            {
                "type": "breadcrumbs",
                "data": {
                    "values": [
                        {"category": "http", "level": "info", "message": "GET /devices"},
                        {"category": "auth", "level": "warning", "message": "token refresh"},
                    ]
                },
            }
        ],
    }


def test_ui_gets_breadcrumbs_inlined() -> None:
    out = format_event_response(_event_with_breadcrumbs(), "markdown", "ui")
    assert "Breadcrumbs" in out
    assert "GET /devices" in out


def test_api_clients_do_not_get_breadcrumbs_inlined() -> None:
    # the MCP keeps breadcrumbs out of issue details on purpose and serves them from its own
    # get_issue_breadcrumbs tool; inlining them here would duplicate that tool and spend up to
    # 5k chars on every call. Everything else still renders.
    out = format_event_response(_event_with_breadcrumbs(), "markdown", "api")
    assert "Breadcrumbs" not in out
    assert "GET /devices" not in out
    assert "## Title" in out


def test_ui_is_the_default_consumer() -> None:
    # the adapter is called with a consumer by the mixin; the default keeps direct callers and
    # existing tests on the UI behaviour rather than silently dropping a section
    assert format_event_response(_event_with_breadcrumbs(), "markdown") == format_event_response(
        _event_with_breadcrumbs(), "markdown", "ui"
    )


def test_only_breadcrumbs_differ_between_consumers() -> None:
    # if the two lists ever diverge further, that should be a deliberate edit to
    # _SECTIONS_EXCLUDED_FOR_API rather than a surprise
    assert set(_SECTIONS_BY_CONSUMER["ui"]) - set(_SECTIONS_BY_CONSUMER["api"]) == {
        breadcrumbs_section
    }


def test_consumer_for_keys_off_auth() -> None:
    # an unrecognised caller must land on "api", the narrower rollout
    assert consumer_for(cast(Request, _FakeRequest(None))) == "ui"
    assert consumer_for(cast(Request, _FakeRequest(object()))) == "api"
