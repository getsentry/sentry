from collections.abc import Generator

from sentry.models.project import Project
from sentry.replays.lib.summarize import (
    EventDict,
    as_log_message,
    get_summary_logs,
    parse_timestamp,
)
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import json


@django_db_all
def test_get_summary_logs(default_project: Project) -> None:
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

    result = get_summary_logs(_faker(), error_events=error_events, project_id=default_project.id)
    assert result == [
        "User experienced an error: 'BadError: something else bad' at 1.0",
        "Logged: hello at 1.5",
        "Logged: world at 2.0",
        "User experienced an error: 'ZeroDivisionError: division by zero' at 3.0",
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
    assert result is None

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {"tag": "performanceSpan", "payload": {"op": "resource.xhr"}},
    }
    assert as_log_message(event) is None

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
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "web-vital",
                "description": "first-contentful-paint",
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


def test_parse_timestamp() -> None:
    # Test None input
    assert parse_timestamp(None, "ms") == 0.0
    assert parse_timestamp(None, "s") == 0.0

    # Test numeric input
    assert parse_timestamp(123.456, "ms") == 123.456
    assert parse_timestamp(123, "s") == 123.0

    # Test string input with ISO format without timezone
    assert parse_timestamp("2023-01-01T12:00:00", "ms") == 1672574400.0 * 1000
    assert parse_timestamp("2023-01-01T12:00:00", "s") == 1672574400.0

    # Test string input with ISO format with timezone offset
    assert parse_timestamp("2023-01-01T12:00:00+00:00", "ms") == 1672574400.0 * 1000
    assert parse_timestamp("2023-01-01T12:00:00.123+00:00", "ms") == 1672574400.123 * 1000
    assert parse_timestamp("2023-01-01T12:00:00+00:00", "s") == 1672574400.0

    # Test string input with ISO format with 'Z' timezone suffix
    assert parse_timestamp("2023-01-01T12:00:00Z", "s") == 1672574400.0
    assert parse_timestamp("2023-01-01T12:00:00.123Z", "ms") == 1672574400.123 * 1000

    # Test invalid input
    assert parse_timestamp("invalid timestamp", "ms") == 0.0
    assert parse_timestamp("", "ms") == 0.0
    assert parse_timestamp("2023-13-01T12:00:00Z", "ms") == 0.0
