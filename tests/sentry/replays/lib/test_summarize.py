from collections.abc import Generator
from unittest.mock import Mock, patch

import pytest

from sentry.replays.lib.summarize import (
    EventDict,
    _parse_iso_timestamp_to_ms,
    as_log_message,
    get_summary_logs,
)
from sentry.utils import json


@patch("sentry.replays.lib.summarize.fetch_feedback_details")
def test_get_summary_logs(mock_fetch_feedback_details: Mock) -> None:

    def _mock_fetch_feedback(feedback_id: str | None, _project_id: int) -> EventDict | None:
        if feedback_id == "12345678123456781234567812345678":
            return EventDict(
                category="feedback",
                id=feedback_id,
                title="User Feedback",
                timestamp=4.0,
                message="Great website!",
            )
        return None

    mock_fetch_feedback_details.side_effect = _mock_fetch_feedback

    def _faker() -> Generator[tuple[int, memoryview]]:
        yield 0, memoryview(
            json.dumps(
                [
                    {
                        "type": 5,
                        "timestamp": 1.5,
                        "data": {
                            "tag": "breadcrumb",
                            "payload": {"category": "console", "message": "hello"},
                        },
                    },
                    {
                        "type": 5,
                        "timestamp": 2.0,
                        "data": {
                            "tag": "breadcrumb",
                            "payload": {"category": "console", "message": "world"},
                        },
                    },
                    {
                        "type": 5,
                        "timestamp": 4.0,
                        "data": {
                            "tag": "breadcrumb",
                            "payload": {
                                "category": "sentry.feedback",
                                "data": {"feedbackId": "12345678123456781234567812345678"},
                            },
                        },
                    },
                ]
            ).encode()
        )

    error_events = [
        EventDict(
            category="error",
            id="123",
            title="ZeroDivisionError",
            timestamp=3.0,
            message="division by zero",
        ),
        EventDict(
            category="error",
            id="234",
            title="BadError",
            timestamp=1.0,
            message="something else bad",
        ),
    ]

    result = get_summary_logs(_faker(), error_events=error_events, project_id=1)
    assert result == [
        "User experienced an error: 'BadError: something else bad' at 1.0",
        "Logged: 'hello' at 1.5",
        "Logged: 'world' at 2.0",
        "User experienced an error: 'ZeroDivisionError: division by zero' at 3.0",
        "User submitted feedback: 'Great website!' at 4.0",
    ]


def test_as_log_message() -> None:
    """Basic coverage for events that do not have dedicated test cases yet."""

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {"tag": "breadcrumb", "payload": {"category": "ui.click", "message": "div"}},
    }
    assert as_log_message(event) is not None

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "category": "ui.slowClickDetected",
                "message": "div",
                "data": {
                    "clickCount": 4,
                    "endReason": "timeout",
                    "timeAfterClickMs": 7000,
                    "node": {"tagName": "button"},
                },
            },
        },
    }
    assert as_log_message(event) is not None

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "category": "ui.slowClickDetected",
                "message": "div",
                "data": {
                    "clickCount": 5,
                    "endReason": "timeout",
                    "timeAfterClickMs": 7000,
                    "node": {"tagName": "button"},
                },
            },
        },
    }
    assert as_log_message(event) is not None

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "navigation.push",
                "description": "url",
            },
        },
    }
    assert as_log_message(event) is not None

    # Test multiclick event
    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "category": "ui.multiClick",
                "message": "div#multiclick-button.btn.primary",
                "data": {
                    "clickCount": 5,
                    "node": {"tagName": "div"},
                },
            },
        },
    }
    assert as_log_message(event) is not None

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {
            "tag": "breadcrumb",
            "payload": {"category": "navigation", "data": {"to": "/"}},
        },
    }
    assert as_log_message(event) is None

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {"tag": "breadcrumb", "payload": {"category": "ui.blur"}},
    }
    assert as_log_message(event) is None

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {"tag": "breadcrumb", "payload": {"category": "ui.focus"}},
    }
    assert as_log_message(event) is None

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "resource.fetch",
                "description": "https://www.z.com/path?q=true",
                "endTimestamp": 0.0,
                "startTimestamp": 0.0,
                "data": {
                    "method": "GET",
                    "statusCode": 404,
                    "response": {"size": 0},
                },
            },
        },
    }
    assert as_log_message(event) is not None

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "resource.fetch",
                "description": "https://www.z.com/path?q=true",
                "endTimestamp": 0.0,
                "startTimestamp": 0.0,
                "data": {
                    "method": "GET",
                    "statusCode": 404,
                    "response": {"wrong": "wrong"},
                },
            },
        },
    }

    result = as_log_message(event)
    assert result is not None
    assert "unknown" not in result

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "web-vital",
                "description": "largest-contentful-paint",
                "data": {"size": 0, "rating": "good"},
            },
        },
    }
    assert as_log_message(event) is not None

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {"tag": "breadcrumb", "payload": {"category": "replay.hydrate-error"}},
    }
    assert as_log_message(event) is not None

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {"tag": "breadcrumb", "payload": {"category": "replay.mutations"}},
    }
    assert as_log_message(event) is None
    assert as_log_message({}) is None


def test_as_log_message_long_console_message() -> None:
    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {"tag": "breadcrumb", "payload": {"category": "console", "message": "a" * 2000}},
    }
    assert as_log_message(event) == f"Logged: '{'a' * 200} [truncated]' at 0.0"


@pytest.mark.parametrize("status_code", [200, 204, 404, 500])
@pytest.mark.parametrize("method", ["GET", "POST"])
def test_as_log_message_resource_fetch(status_code: int, method: str) -> None:
    event = {
        "type": 5,
        "timestamp": 4.0,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "resource.fetch",
                "description": "https://www.z.com/path?q=true",
                "endTimestamp": 6.0,
                "startTimestamp": 4.0,
                "data": {
                    "method": method,
                    "statusCode": status_code,
                    "response": {"size": 42},
                },
            },
        },
    }

    if status_code >= 300:
        assert (
            as_log_message(event)
            == f'Fetch request "{method} www.z.com/path?q=true" failed with {status_code} (42 bytes) at 4000.0'
        )
    else:
        assert as_log_message(event) is None


@pytest.mark.parametrize("too_long", [True, False])
def test_as_log_message_resource_fetch_invalid_url(too_long: bool) -> None:

    # Real example of a filtered URL that fails urlparse.
    url = (
        "https://test-string-[Filtered].storage.googleapis.com/guide-content/abcd.json?sha256="
        + "abcd" * (100 if too_long else 1)
    )

    event = {
        "type": 5,
        "timestamp": 4.0,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "resource.fetch",
                "description": url,
                "endTimestamp": 6.0,
                "startTimestamp": 4.0,
                "data": {
                    "method": "GET",
                    "statusCode": 404,
                    "response": {"size": 42},
                },
            },
        },
    }

    if too_long:
        assert (
            as_log_message(event)
            == f'Fetch request "GET {url[:200]} [truncated]" failed with 404 (42 bytes) at 4000.0'
        )
    else:
        assert (
            as_log_message(event)
            == f'Fetch request "GET {url}" failed with 404 (42 bytes) at 4000.0'
        )


@pytest.mark.parametrize("status_code", [200, 204, 404, 500])
@pytest.mark.parametrize("method", ["GET", "POST"])
def test_as_log_message_resource_xhr(status_code: int, method: str) -> None:
    event = {
        "type": 5,
        "timestamp": 4.0,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "resource.xhr",
                "description": "https://www.z.com/path?q=true",
                "endTimestamp": 4.0,
                "startTimestamp": 6.0,
                "data": {
                    "method": method,
                    "statusCode": status_code,
                    "response": {"size": 42},
                },
            },
        },
    }

    if status_code >= 300:
        assert (
            as_log_message(event)
            == f'XHR request "{method} www.z.com/path?q=true" failed with {status_code} (42 bytes) at 4000.0'
        )
    else:
        assert as_log_message(event) is None


@pytest.mark.parametrize("too_long", [True, False])
def test_as_log_message_resource_xhr_invalid_url(too_long: bool) -> None:

    # Real example of a filtered URL that fails urlparse.
    url = (
        "https://pendo-static-[Filtered].storage.googleapis.com/guide-content/abcd.json?sha256="
        + "abcd" * (100 if too_long else 1)
    )

    event = {
        "type": 5,
        "timestamp": 4.0,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "resource.xhr",
                "description": url,
                "endTimestamp": 4.0,
                "startTimestamp": 6.0,
                "data": {
                    "method": "GET",
                    "statusCode": 404,
                    "response": {"size": 42},
                },
            },
        },
    }

    if too_long:
        assert (
            as_log_message(event)
            == f'XHR request "GET {url[:200]} [truncated]" failed with 404 (42 bytes) at 4000.0'
        )
    else:
        assert (
            as_log_message(event) == f'XHR request "GET {url}" failed with 404 (42 bytes) at 4000.0'
        )


def test_parse_iso_timestamp_to_ms() -> None:
    # Without timezone
    assert _parse_iso_timestamp_to_ms("2023-01-01T12:00:00") == 1672574400000
    assert _parse_iso_timestamp_to_ms("2023-01-01T12:00:00.123") == 1672574400123

    # With timezone offset
    assert _parse_iso_timestamp_to_ms("2023-01-01T12:00:00+00:00") == 1672574400000
    assert _parse_iso_timestamp_to_ms("2023-01-01T12:00:00.123+00:00") == 1672574400123

    # With 'Z' timezone suffix
    assert _parse_iso_timestamp_to_ms("2023-01-01T12:00:00Z") == 1672574400000
    assert _parse_iso_timestamp_to_ms("2023-01-01T12:00:00.123Z") == 1672574400123

    # Invalid input
    assert _parse_iso_timestamp_to_ms("invalid timestamp") == 0.0
    assert _parse_iso_timestamp_to_ms("") == 0.0
    assert _parse_iso_timestamp_to_ms("2023-13-01T12:00:00Z") == 0.0
