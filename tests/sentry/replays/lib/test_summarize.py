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
                timestamp=1756400490870,
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
                        "timestamp": 1756400489863,
                        "data": {
                            "tag": "breadcrumb",
                            "payload": {
                                "timestamp": 1756400489.863,
                                "type": "default",
                                "category": "console",
                                "data": {"logger": "replay"},
                                "level": "log",
                                "message": "hello",
                            },
                        },
                    },
                    {
                        "type": 5,
                        "timestamp": 1756400490866,
                        "data": {
                            "tag": "breadcrumb",
                            "payload": {
                                "timestamp": 1756400490.866,
                                "type": "default",
                                "category": "console",
                                "data": {"logger": "replay"},
                                "level": "log",
                                "message": "world",
                            },
                        },
                    },
                    {
                        "type": 5,
                        "timestamp": 1756400490870,
                        "data": {
                            "tag": "breadcrumb",
                            "payload": {
                                "timestamp": 1756400490.870,
                                "type": "default",
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
            timestamp=1756400490869,
            message="division by zero",
        ),
        EventDict(
            category="error",
            id="234",
            title="BadError",
            timestamp=1756400489849,
            message="something else bad",
        ),
    ]

    result = get_summary_logs(_faker(), error_events=error_events, project_id=1)

    assert result == [
        "User experienced an error: 'BadError: something else bad' at 1756400489849",
        "Logged: 'hello' at 1756400489863",
        "Logged: 'world' at 1756400490866",
        "User experienced an error: 'ZeroDivisionError: division by zero' at 1756400490869",
        "User submitted feedback: 'Great website!' at 1756400490870",
    ]


def test_as_log_message() -> None:
    """Basic coverage for events that do not have dedicated test cases yet."""

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
        "data": {"tag": "breadcrumb", "payload": {"category": "replay.hydrate-error"}},
    }
    assert as_log_message(event) is not None

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {"tag": "breadcrumb", "payload": {"category": "replay.mutations"}},
    }
    assert as_log_message(event) is None


def test_as_log_message_click() -> None:
    event = {
        "type": 5,
        "timestamp": 1756400639566,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "timestamp": 1756400639.566,
                "type": "default",
                "category": "ui.click",
                "message": "TabsContainer > TabsWrap > BaseTabList > ChonkSwitch > FloatingTabWrap",
                "data": {
                    "nodeId": 3795,
                    "node": {
                        "id": 3795,
                        "tagName": "li",
                        "textContent": "",
                        "attributes": {
                            "id": "react-aria8333570968-tab-logs",
                            "role": "tab",
                            "class": "app-122pptr e1md5v960",
                            "data-sentry-component": "FloatingTabWrap",
                        },
                    },
                },
            },
        },
    }
    assert (
        as_log_message(event)
        == "User clicked on TabsContainer > TabsWrap > BaseTabList > ChonkSwitch > FloatingTabWrap at 1756400639566"
    )


def test_as_log_message_lcp() -> None:
    event = (
        {
            "type": 5,
            "timestamp": 1756400489.048,
            "data": {
                "tag": "performanceSpan",
                "payload": {
                    "op": "web-vital",
                    "description": "largest-contentful-paint",
                    "startTimestamp": 1756400489.048,
                    "endTimestamp": 1756400489.048,
                    "data": {"value": 623, "size": 623, "rating": "good"},
                },
            },
        },
    )
    assert (
        as_log_message(event)
        == "Application largest contentful paint: 623 ms and has a good rating at 1756400489048"
    )


def test_as_log_message_navigation() -> None:
    event = (
        {
            "type": 5,
            "timestamp": 1756400579304,
            "data": {
                "tag": "breadcrumb",
                "payload": {
                    "timestamp": 1756400579.304,
                    "type": "default",
                    "category": "navigation",
                    "data": {
                        "from": "https://url-example-previous.com",
                        "to": "https://url-example.com",
                    },
                },
            },
        },
    )
    assert as_log_message(event) is None


def test_as_log_message_feedback() -> None:
    event = (
        {
            "type": 5,
            "timestamp": 1756400970768,
            "data": {
                "tag": "breadcrumb",
                "payload": {
                    "timestamp": 1756400970.768,
                    "type": "default",
                    "category": "sentry.feedback",
                    "data": {"feedbackId": "332f05068b2d43e6b5c5557ffecfcd0f"},
                },
            },
        },
    )
    assert as_log_message(event) is None


def test_as_log_message_invalid_input() -> None:
    assert as_log_message({}) is None
    assert as_log_message({"blah": "wrong"}) is None


def test_as_log_message_ui_blur() -> None:
    event = {
        "type": 5,
        "timestamp": 1756400752.714,
        "data": {
            "tag": "breadcrumb",
            "payload": {"timestamp": 1756400752.714, "type": "default", "category": "ui.blur"},
        },
    }
    assert as_log_message(event) is None


def test_as_log_message_ui_focus() -> None:
    event = {
        "type": 5,
        "timestamp": 1756401009.41,
        "data": {
            "tag": "breadcrumb",
            "payload": {"timestamp": 1756401009.41, "type": "default", "category": "ui.focus"},
        },
    }
    assert as_log_message(event) is None


def test_as_log_message_resource_img() -> None:
    event = {
        "type": 5,
        "timestamp": 1756400489.65,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "resource.img",
                "description": "https://us.sentry.io/img-link",
                "startTimestamp": 1756400489.65,
                "endTimestamp": 1756400489.869,
                "data": {"size": 0, "statusCode": 0, "decodedBodySize": 0, "encodedBodySize": 0},
            },
        },
    }
    assert as_log_message(event) is None


def test_as_log_message_resource_script() -> None:
    event = {
        "type": 5,
        "timestamp": 1756400490.308,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "resource.script",
                "description": "https://data.test.io/data/test",
                "startTimestamp": 1756400490.308,
                "endTimestamp": 1756400491.236,
                "data": {"size": 0, "statusCode": 0, "decodedBodySize": 0, "encodedBodySize": 0},
            },
        },
    }
    assert as_log_message(event) is None


def test_as_log_message_navigation_span() -> None:
    event = (
        {
            "type": 5,
            "timestamp": 1756400579.304,
            "data": {
                "tag": "performanceSpan",
                "payload": {
                    "op": "navigation.push",
                    "description": "https://url-example.com",
                    "startTimestamp": 1756400579.304,
                    "endTimestamp": 1756400579.304,
                    "data": {"previous": "https://url-example-prev.com"},
                },
            },
        },
    )
    assert as_log_message(event) == "User navigated to: https://url-example.com at 1756400579304"


def test_as_log_message_long_console_message() -> None:
    event = {
        "type": 5,
        "timestamp": 1756406283937,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "timestamp": 1756406283.937,
                "type": "default",
                "category": "console",
                "data": {"logger": "replay"},
                "level": "log",
                "message": "a" * 2000,
            },
        },
    }
    assert as_log_message(event) == f"Logged: '{'a' * 200} [truncated]' at 1756406283937"


@pytest.mark.parametrize("status_code", [200, 204, 404, 500])
@pytest.mark.parametrize("method", ["GET", "POST"])
def test_as_log_message_resource_fetch(status_code: int, method: str) -> None:
    event = {
        "type": 5,
        "timestamp": 1756401153.805,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "resource.fetch",
                "description": "https://www.z.com/path?q=true",
                "endTimestamp": 1756401154.178,
                "startTimestamp": 1756401153.805,
                "data": {
                    "method": method,
                    "statusCode": status_code,
                    "request": {
                        "headers": {
                            "content-type": "application/json",
                            "accept": "application/json; charset=utf-8",
                            "sentry-trace": "12345678901234567890123456789012",
                        }
                    },
                    "response": {
                        "headers": {
                            "content-length": "2",
                            "content-type": "application/json",
                            "link": "https://us.sentry.io/api/0/test-link",
                        },
                        "size": 42,
                        "body": [],
                    },
                },
            },
        },
    }

    if status_code >= 300:
        assert (
            as_log_message(event)
            == f'Fetch request "{method} www.z.com/path?q=true" failed with {status_code} (42 bytes) at 1756401153805.0'
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
        "timestamp": 1756401153.805,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "resource.fetch",
                "description": url,
                "endTimestamp": 1756401154.178,
                "startTimestamp": 1756401153.805,
                "data": {
                    "method": "GET",
                    "statusCode": 404,
                    "request": {
                        "headers": {
                            "content-type": "application/json",
                            "accept": "application/json; charset=utf-8",
                            "sentry-trace": "12345678901234567890123456789012",
                        }
                    },
                    "response": {
                        "headers": {
                            "content-length": "2",
                            "content-type": "application/json",
                            "link": "https://us.sentry.io/api/0/test-link",
                        },
                        "size": 42,
                        "body": [],
                    },
                },
            },
        },
    }

    if too_long:
        assert (
            as_log_message(event)
            == f'Fetch request "GET {url[:200]} [truncated]" failed with 404 (42 bytes) at 1756401153805.0'
        )
    else:
        assert (
            as_log_message(event)
            == f'Fetch request "GET {url}" failed with 404 (42 bytes) at 1756401153805.0'
        )


@pytest.mark.parametrize("status_code", [200, 204, 404, 500])
@pytest.mark.parametrize("method", ["GET", "POST"])
def test_as_log_message_resource_xhr(status_code: int, method: str) -> None:
    event = {
        "type": 5,
        "timestamp": 1756401153.805,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "resource.xhr",
                "description": "https://www.z.com/path?q=true",
                "endTimestamp": 1756401154.178,
                "startTimestamp": 1756401153.805,
                "data": {
                    "method": method,
                    "statusCode": status_code,
                    "request": {
                        "headers": {
                            "content-type": "application/json",
                            "accept": "application/json; charset=utf-8",
                            "sentry-trace": "12345678901234567890123456789012",
                        }
                    },
                    "response": {
                        "headers": {
                            "content-length": "2",
                            "content-type": "application/json",
                            "link": "https://us.sentry.io/api/0/test-link",
                        },
                        "size": 42,
                        "body": [],
                    },
                },
            },
        },
    }

    if status_code >= 300:
        assert (
            as_log_message(event)
            == f'XHR request "{method} www.z.com/path?q=true" failed with {status_code} (42 bytes) at 1756401153805.0'
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
        "timestamp": 1756401153.805,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "resource.xhr",
                "description": url,
                "endTimestamp": 1756401154.178,
                "startTimestamp": 1756401153.805,
                "data": {
                    "method": "GET",
                    "statusCode": 404,
                    "request": {
                        "headers": {
                            "content-type": "application/json",
                            "accept": "application/json; charset=utf-8",
                            "sentry-trace": "12345678901234567890123456789012",
                        }
                    },
                    "response": {
                        "headers": {
                            "content-length": "2",
                            "content-type": "application/json",
                            "link": "https://us.sentry.io/api/0/test-link",
                        },
                        "size": 42,
                        "body": [],
                    },
                },
            },
        },
    }

    if too_long:
        assert (
            as_log_message(event)
            == f'XHR request "GET {url[:200]} [truncated]" failed with 404 (42 bytes) at 1756401153805.0'
        )
    else:
        assert (
            as_log_message(event)
            == f'XHR request "GET {url}" failed with 404 (42 bytes) at 1756401153805.0'
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
