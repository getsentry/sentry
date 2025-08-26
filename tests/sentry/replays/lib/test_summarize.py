from collections.abc import Generator
from unittest.mock import Mock, patch

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
        "data": {"tag": "breadcrumb", "payload": {"category": "console", "message": "t"}},
    }
    assert as_log_message(event) is not None

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
                "op": "resource.fetch",
                "description": "https://www.z.com/path?q=true",
                "endTimestamp": 0.0,
                "startTimestamp": 0.0,
                "data": {
                    "method": "GET",
                    "statusCode": 200,
                    "response": {"size": 0},
                },
            },
        },
    }

    result = as_log_message(event)
    assert result is None  # we filter out 200 status codes

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "resource.xhr",
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
