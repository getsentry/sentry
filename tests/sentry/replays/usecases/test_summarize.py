import uuid
import zlib
from collections.abc import Generator
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import MagicMock, Mock, patch

import pytest
import requests
from django.conf import settings

from sentry.feedback.lib.utils import FeedbackCreationSource
from sentry.feedback.usecases.ingest.create_feedback import create_feedback_issue
from sentry.replays.lib.storage import FilestoreBlob, RecordingSegmentStorageMeta
from sentry.replays.testutils import mock_replay
from sentry.replays.usecases.ingest.event_parser import get_timestamp_unit, which
from sentry.replays.usecases.summarize import (
    EventDict,
    _parse_iso_timestamp_to_ms,
    as_log_message,
    get_summary_logs,
    rpc_get_replay_summary_logs,
)
from sentry.testutils.cases import SnubaTestCase, TransactionTestCase
from sentry.testutils.skips import requires_snuba
from sentry.utils import json

"""
Tests for event types that do not return None for the log message
"""


@patch("sentry.replays.usecases.summarize.fetch_feedback_details")
def test_get_summary_logs_from_segments(mock_fetch_feedback_details: Mock) -> None:

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
        "User experienced an error: 'BadError: something else bad' at 1756400489849.0",
        "Logged: 'hello' at 1756400489863.0",
        "Logged: 'world' at 1756400490866.0",
        "User experienced an error: 'ZeroDivisionError: division by zero' at 1756400490869.0",
        "User submitted feedback: 'Great website!' at 1756400490870.0",
    ]


def test_as_log_message_rage_click() -> None:
    event = {
        "type": 5,
        "timestamp": 1756175998029,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "type": "default",
                "message": "TabsWrap > BaseTabList > ChonkSwitch > ChonkSwitch > InnerWrap",
                "timestamp": 1756175998.029,
                "category": "ui.slowClickDetected",
                "data": {
                    "nodeId": 3868,
                    "node": {
                        "id": 3868,
                        "tagName": "a",
                        "textContent": "",
                        "attributes": {
                            "data-sentry-component": "InnerWrap",
                            "class": "app-bawkde e1md5v962",
                        },
                    },
                    "url": "https://test.sentry.io/insights/frontend/sessions/",
                    "route": "/insights/frontend/sessions/",
                    "timeAfterClickMs": 7000,
                    "endReason": "timeout",
                    "clickCount": 5,
                },
            },
        },
    }

    assert (
        as_log_message(event)
        == "User rage clicked on TabsWrap > BaseTabList > ChonkSwitch > ChonkSwitch > InnerWrap but the triggered action was slow to complete at 1756175998029.0"
    )
    assert get_timestamp_unit(which(event)) == "ms"


def test_as_log_message_dead_click() -> None:
    event = {
        "type": 5,
        "timestamp": 1756176027605,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "type": "default",
                "message": "Body > Section > div.app-z8xaty.exdtrvw0 > div > ChonkSwitch",
                "timestamp": 1756176027.605,
                "category": "ui.slowClickDetected",
                "data": {
                    "nodeId": 860,
                    "node": {
                        "id": 860,
                        "tagName": "a",
                        "textContent": "",
                        "attributes": {
                            "class": "ehp4qnd0 app-bxjpl0 e1fo43l910",
                            "data-sentry-component": "ChonkSwitch",
                        },
                    },
                    "url": "https://test.sentry.io/insights/frontend/http/",
                    "route": "/insights/frontend/http/",
                    "timeAfterClickMs": 7000,
                    "endReason": "timeout",
                    "clickCount": 1,
                },
            },
        },
    }
    assert (
        as_log_message(event)
        == "User clicked on Body > Section > div.app-z8xaty.exdtrvw0 > div > ChonkSwitch but the triggered action was slow to complete at 1756176027605.0"
    )
    assert get_timestamp_unit(which(event)) == "ms"


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
        == "User clicked on TabsContainer > TabsWrap > BaseTabList > ChonkSwitch > FloatingTabWrap at 1756400639566.0"
    )
    assert get_timestamp_unit(which(event)) == "ms"


def test_as_log_message_tap() -> None:
    event = {
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "level": "info",
                "timestamp": 1758212015.458114,
                "category": "ui.tap",
                "data": {
                    "path": [
                        {"name": "View"},
                        {"name": "ScrollView"},
                        {"name": "AnimatedComponent(ScrollView)"},
                        {"name": "ScrollView"},
                    ]
                },
                "message": "ScrollView > AnimatedComponent(ScrollView) > ScrollView > View",
                "type": "default",
            },
        },
        "type": 5,
        "timestamp": 1758212015458,
    }
    assert (
        as_log_message(event)
        == "User tapped on ScrollView > AnimatedComponent(ScrollView) > ScrollView > View at 1758212015458.0"
    )
    assert get_timestamp_unit(which(event)) == "ms"


def test_as_log_message_lcp() -> None:
    event = {
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
    }

    assert (
        as_log_message(event)
        == "Application largest contentful paint: 623 ms and has a good rating at 1756400489048.0"
    )
    assert get_timestamp_unit(which(event)) == "s"


def test_as_log_message_hydration_error() -> None:
    event = {
        "type": 5,
        "timestamp": 1756444686898,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "timestamp": 1756444686.898,
                "type": "default",
                "category": "replay.hydrate-error",
                "data": {"url": "https://docs.sentry.io/platforms/javascript/feature-flags/"},
            },
        },
    }
    assert as_log_message(event) == "There was a hydration error on the page at 1756444686898.0"
    assert get_timestamp_unit(which(event)) == "ms"


def test_as_log_message_navigation_span() -> None:
    event = {
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
    }
    assert (
        as_log_message(event, is_mobile_replay=False)
        == "User navigated to: https://url-example.com at 1756400579304.0"
    )
    assert as_log_message(event, is_mobile_replay=True) is None
    assert get_timestamp_unit(which(event)) == "s"


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
    assert as_log_message(event) == f"Logged: '{'a' * 200} [truncated]' at 1756406283937.0"
    assert get_timestamp_unit(which(event)) == "ms"


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

    assert get_timestamp_unit(which(event)) == "s"


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

    assert get_timestamp_unit(which(event)) == "s"


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


"""
Tests for events that return None for the log message
"""


def test_as_log_message_slow_click() -> None:
    event = {
        "type": 5,
        "timestamp": 1756176027605,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "type": "default",
                "message": "Body > Section > div.app-z8xaty.exdtrvw0 > div > ChonkSwitch",
                "timestamp": 1756176027.605,
                "category": "ui.slowClickDetected",
                "data": {
                    "nodeId": 860,
                    "node": {
                        "id": 860,
                        "tagName": "a",
                        "textContent": "",
                        "attributes": {
                            "class": "ehp4qnd0 app-bxjpl0 e1fo43l910",
                            "data-sentry-component": "ChonkSwitch",
                        },
                    },
                    "url": "https://test.sentry.io/insights/frontend/http/",
                    "route": "/insights/frontend/http/",
                    "timeAfterClickMs": 5884.000062942505,
                    "endReason": "mutation",
                    "clickCount": 1,
                },
            },
        },
    }
    assert as_log_message(event) is None
    assert get_timestamp_unit(which(event)) == "ms"


def test_as_log_message_navigation() -> None:
    event = {
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
    }
    assert as_log_message(event, is_mobile_replay=False) is None
    assert (
        as_log_message(event, is_mobile_replay=True)
        == "User navigated to: https://url-example.com at 1756400579304.0"
    )
    assert get_timestamp_unit(which(event)) == "ms"


def test_as_log_message_feedback() -> None:
    event = {
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
    }
    assert as_log_message(event) is None
    assert get_timestamp_unit(which(event)) == "ms"


@pytest.mark.parametrize("event", [{}, {"blah": "wrong"}])
def test_as_log_message_unknown(event: dict[str, Any]) -> None:
    assert as_log_message(event) is None
    assert get_timestamp_unit(which(event)) == "ms"


def test_as_log_message_mutations() -> None:
    event = {
        "type": 5,
        "timestamp": 1756176180.945,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "timestamp": 1756176180.945,
                "type": "default",
                "category": "replay.mutations",
                "data": {"count": 981, "limit": False},
            },
        },
    }
    assert as_log_message(event) is None
    assert get_timestamp_unit(which(event)) == "s"


def test_as_log_message_memory() -> None:
    event = {
        "type": 5,
        "timestamp": 1756176181.81,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "memory",
                "description": "memory",
                "startTimestamp": 1756176181.81,
                "endTimestamp": 1756176181.81,
                "data": {
                    "memory": {
                        "jsHeapSizeLimit": 2248146944,
                        "totalJSHeapSize": 189315135,
                        "usedJSHeapSize": 95611483,
                    }
                },
            },
        },
    }
    assert as_log_message(event) is None
    assert get_timestamp_unit(which(event)) == "s"


def test_as_log_message_cls() -> None:
    event = {
        "type": 5,
        "timestamp": 1756176012.496,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "web-vital",
                "description": "cumulative-layout-shift",
                "startTimestamp": 1756176012.496,
                "endTimestamp": 1756176012.496,
                "data": {
                    "value": 0,
                    "size": 0,
                    "rating": "good",
                    "nodeIds": [],
                    "attributions": [],
                },
            },
        },
    }
    assert as_log_message(event) is None
    assert get_timestamp_unit(which(event)) == "s"


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
    assert get_timestamp_unit(which(event)) == "s"


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
    assert get_timestamp_unit(which(event)) == "s"


def test_as_log_message_options() -> None:
    event = {
        "type": 5,
        "timestamp": 1756444686855,
        "data": {
            "tag": "options",
            "payload": {
                "shouldRecordCanvas": False,
                "sessionSampleRate": 0.1,
                "errorSampleRate": 1,
                "useCompressionOption": True,
                "blockAllMedia": False,
                "maskAllText": False,
                "maskAllInputs": True,
                "useCompression": False,
                "networkDetailHasUrls": False,
                "networkCaptureBodies": True,
                "networkRequestHasHeaders": True,
                "networkResponseHasHeaders": True,
            },
        },
    }
    assert as_log_message(event) is None
    assert get_timestamp_unit(which(event)) == "ms"


def test_as_log_message_canvas() -> None:
    event = {
        "type": 3,
        "data": {
            "source": 9,
            "id": 118,
            "type": 0,
            "commands": [
                {"property": "clearRect", "args": [0, 0, 402, 380]},
                {
                    "property": "drawImage",
                    "args": [
                        {
                            "rr_type": "ImageBitmap",
                            "args": [
                                {
                                    "rr_type": "Blob",
                                    "data": [
                                        {
                                            "rr_type": "ArrayBuffer",
                                            "base64": "some-insanely-long-value",
                                        }
                                    ],
                                    "type": "image/webp",
                                }
                            ],
                        },
                        0,
                        0,
                        402,
                        380,
                    ],
                },
            ],
        },
        "timestamp": 1756214056166,
    }
    assert as_log_message(event) is None
    assert get_timestamp_unit(which(event)) == "ms"


def test_as_log_message_multiclick() -> None:
    event = {
        "type": 5,
        "timestamp": 1756176027605,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "type": "default",
                "category": "ui.multiClick",
                "message": "body > button#mutationButtonImmediately",
                "timestamp": 1756176027605,
                "data": {
                    "clickCount": 5,
                    "node": {"tagName": "div"},
                },
            },
        },
    }
    assert as_log_message(event) is None
    assert get_timestamp_unit(which(event)) == "ms"


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
    assert get_timestamp_unit(which(event)) == "s"


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
    assert get_timestamp_unit(which(event)) == "s"


def test_as_log_message_device_battery() -> None:
    event = {
        "type": 5,
        "timestamp": 1753203886279,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "type": "default",
                "timestamp": 1753203886.279,
                "category": "device.battery",
                "data": {"level": 100.0, "charging": False},
            },
        },
    }
    assert as_log_message(event) == "Device battery was 100.0% and not charging at 1753203886279.0"
    assert get_timestamp_unit(which(event)) == "ms"


def test_as_log_message_device_orientation() -> None:
    event = {
        "type": 5,
        "timestamp": 1758212033534,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "level": "none",
                "category": "device.orientation",
                "timestamp": 1758212033.534864,
                "data": {"position": "landscape"},
                "type": "default",
            },
        },
    }
    assert as_log_message(event) == "Device orientation was changed to landscape at 1758212033534.0"
    assert get_timestamp_unit(which(event)) == "ms"


def test_as_log_message_device_connectivity() -> None:
    event = {
        "type": 5,
        "timestamp": 1758733250547,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "type": "default",
                "timestamp": 1758733250.547,
                "category": "device.connectivity",
                "data": {"state": "wifi"},
            },
        },
    }
    assert as_log_message(event) == "Device connectivity was changed to wifi at 1758733250547.0"
    assert get_timestamp_unit(which(event)) == "ms"


def test_as_log_message_scroll() -> None:
    event = {
        "type": 5,
        "timestamp": 1760948639388,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "type": "default",
                "timestamp": 1760948639.388,
                "category": "ui.scroll",
                "level": "info",
                "data": {
                    "view.class": "androidx.recyclerview.widget.RecyclerView",
                    "view.id": "recycler_view",
                    "direction": "up",
                },
            },
        },
    }
    assert as_log_message(event) == "User scrolled recycler_view up at 1760948639388.0"
    assert get_timestamp_unit(which(event)) == "ms"


def test_as_log_message_swipe() -> None:
    event = {
        "type": 5,
        "timestamp": 1760948640299,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "type": "default",
                "timestamp": 1760948640.299,
                "category": "ui.swipe",
                "level": "info",
                "data": {
                    "view.class": "androidx.recyclerview.widget.RecyclerView",
                    "view.id": "recycler_view",
                    "direction": "up",
                },
            },
        },
    }
    assert as_log_message(event) == "User swiped recycler_view up at 1760948640299.0"
    assert get_timestamp_unit(which(event)) == "ms"


def test_as_log_message_background() -> None:
    event = {
        "type": 5,
        "timestamp": 1758735184405,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "type": "default",
                "timestamp": 1758735184.405,
                "category": "app.background",
                "data": {},
            },
        },
    }
    assert as_log_message(event) == "User moved the app to the background at 1758735184405.0"
    assert get_timestamp_unit(which(event)) == "ms"


def test_as_log_message_foreground() -> None:
    event = {
        "type": 5,
        "timestamp": 1758733250461,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "type": "default",
                "timestamp": 1758733250.461,
                "category": "app.foreground",
                "data": {},
            },
        },
    }
    assert as_log_message(event) == "User moved the app to the foreground at 1758733250461.0"
    assert get_timestamp_unit(which(event)) == "ms"


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


@requires_snuba
class RpcGetReplaySummaryLogsTestCase(
    TransactionTestCase,
    SnubaTestCase,
):
    def setUp(self) -> None:
        super().setUp()
        self.replay_id = uuid.uuid4().hex

    def store_replay(self, dt: datetime | None = None, **kwargs: Any) -> None:
        replay = mock_replay(
            dt or datetime.now(UTC) - timedelta(minutes=1),
            self.project.id,
            self.replay_id,
            **kwargs,
        )
        response = requests.post(
            settings.SENTRY_SNUBA + "/tests/entities/replays/insert", json=[replay]
        )
        assert response.status_code == 200

    def save_recording_segment(
        self, segment_id: int, data: bytes, compressed: bool = True, is_archived: bool = False
    ) -> None:
        metadata = RecordingSegmentStorageMeta(
            project_id=self.project.id,
            replay_id=self.replay_id,
            segment_id=segment_id,
            retention_days=30,
            file_id=None,
        )
        FilestoreBlob().set(metadata, zlib.compress(data) if compressed else data)

    def test_rpc_simple(self) -> None:
        now = datetime.now(UTC)
        replay_start = now - timedelta(minutes=1)

        data = [
            {
                "type": 5,
                "timestamp": replay_start.timestamp() * 1000,
                "data": {
                    "tag": "breadcrumb",
                    "payload": {"category": "console", "message": "hello"},
                },
            },
            {
                "type": 5,
                "timestamp": replay_start.timestamp() * 1000,
                "data": {
                    "tag": "breadcrumb",
                    "payload": {"category": "console", "message": "world"},
                },
            },
        ]
        self.save_recording_segment(0, json.dumps(data).encode())
        self.save_recording_segment(1, json.dumps([]).encode())
        self.store_replay(dt=replay_start)

        response = rpc_get_replay_summary_logs(
            self.project.id,
            self.replay_id,
            2,
        )

        timestamp_ms = replay_start.timestamp() * 1000
        assert response == {
            "logs": [f"Logged: 'hello' at {timestamp_ms}", f"Logged: 'world' at {timestamp_ms}"]
        }

    def test_rpc_with_both_direct_and_trace_connected_errors(self) -> None:
        """Test handling of breadcrumbs with both direct and trace connected errors. Error logs should not be duplicated."""
        now = datetime.now(UTC)
        trace_id = uuid.uuid4().hex
        span_id = "1" + uuid.uuid4().hex[:15]

        # Create a direct error event that is not trace connected.
        direct_event_id = uuid.uuid4().hex
        direct_error_timestamp = (now - timedelta(minutes=5)).timestamp()
        self.store_event(
            data={
                "event_id": direct_event_id,
                "timestamp": direct_error_timestamp,
                "exception": {
                    "values": [
                        {
                            "type": "ZeroDivisionError",
                            "value": "division by zero",
                        }
                    ]
                },
                "contexts": {
                    "replay": {"replay_id": self.replay_id},
                    "trace": {
                        "type": "trace",
                        "trace_id": uuid.uuid4().hex,
                        "span_id": span_id,
                    },
                },
            },
            project_id=self.project.id,
        )

        # Create a trace connected error event
        connected_event_id = uuid.uuid4().hex
        connected_error_timestamp = (now - timedelta(minutes=3)).timestamp()
        project_2 = self.create_project()
        self.store_event(
            data={
                "event_id": connected_event_id,
                "timestamp": connected_error_timestamp,
                "exception": {
                    "values": [
                        {
                            "type": "ConnectionError",
                            "value": "Failed to connect to database",
                        }
                    ]
                },
                "contexts": {
                    "trace": {
                        "type": "trace",
                        "trace_id": trace_id,
                        "span_id": span_id,
                    }
                },
            },
            project_id=project_2.id,
        )

        # Store the replay with both error IDs and trace IDs in the time range
        self.store_replay(dt=now - timedelta(minutes=10), segment_id=0, trace_ids=[trace_id])
        self.store_replay(
            dt=now - timedelta(minutes=1),
            segment_id=1,
            error_ids=[direct_event_id],
            trace_ids=[trace_id],
        )

        data = [
            {
                "type": 5,
                "timestamp": (now - timedelta(minutes=1)).timestamp() * 1000,
                "data": {
                    "tag": "breadcrumb",
                    "payload": {"category": "console", "message": "hello"},
                },
            }
        ]
        self.save_recording_segment(0, json.dumps(data).encode())

        response = rpc_get_replay_summary_logs(
            self.project.id,
            self.replay_id,
            1,
        )

        logs = response["logs"]
        assert len(logs) == 3
        assert any("ZeroDivisionError" in log for log in logs)
        assert any("division by zero" in log for log in logs)
        assert any("ConnectionError" in log for log in logs)
        assert any("Failed to connect to database" in log for log in logs)

    def test_rpc_with_feedback_breadcrumb(self) -> None:
        """Test handling of a feedback breadcrumb when the feedback
        is in nodestore, but hasn't reached Snuba yet.
        If the feedback is in Snuba (guaranteed for SDK v8.0.0+),
        it should be de-duped like in the duplicate_feedback test below."""

        dt = datetime.now(UTC) - timedelta(minutes=3)
        feedback_event_id = uuid.uuid4().hex

        self.store_event(
            data={
                "type": "feedback",
                "event_id": feedback_event_id,
                "timestamp": dt.timestamp(),
                "contexts": {
                    "feedback": {
                        "contact_email": "josh.ferge@sentry.io",
                        "name": "Josh Ferge",
                        "message": "Great website!",
                        "replay_id": self.replay_id,
                        "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
                    },
                },
            },
            project_id=self.project.id,
        )
        self.store_replay(dt=dt)

        data = [
            {
                "type": 5,
                "timestamp": dt.timestamp() * 1000,
                "data": {
                    "tag": "breadcrumb",
                    "payload": {
                        "category": "sentry.feedback",
                        "data": {"feedbackId": feedback_event_id},
                    },
                },
            },
        ]
        self.save_recording_segment(0, json.dumps(data).encode())

        response = rpc_get_replay_summary_logs(
            self.project.id,
            self.replay_id,
            1,
        )

        logs = response["logs"]
        assert len(logs) == 1
        assert "User submitted feedback: 'Great website!'" in logs[0]

    def test_rpc_with_trace_errors_both_datasets(self) -> None:
        """Test that trace connected error snuba query works correctly with both datasets."""

        now = datetime.now(UTC)
        project_1 = self.create_project()
        project_2 = self.create_project()

        # Create regular error event - errors dataset
        event_id_1 = uuid.uuid4().hex
        trace_id_1 = uuid.uuid4().hex
        dt_1 = now - timedelta(minutes=5)
        self.store_event(
            data={
                "event_id": event_id_1,
                "timestamp": dt_1.timestamp(),
                "exception": {
                    "values": [
                        {
                            "type": "ValueError",
                            "value": "Invalid input",
                        }
                    ]
                },
                "contexts": {
                    "trace": {
                        "type": "trace",
                        "trace_id": trace_id_1,
                        "span_id": "1" + uuid.uuid4().hex[:15],
                    }
                },
            },
            project_id=project_1.id,
        )

        # Create feedback event - issuePlatform dataset
        event_id_2 = uuid.uuid4().hex
        trace_id_2 = uuid.uuid4().hex
        dt_2 = now - timedelta(minutes=2)

        feedback_data = {
            "type": "feedback",
            "event_id": event_id_2,
            "timestamp": dt_2.timestamp(),
            "contexts": {
                "feedback": {
                    "contact_email": "test@example.com",
                    "name": "Test User",
                    "message": "Great website",
                    "replay_id": self.replay_id,
                    "url": "https://example.com",
                },
                "trace": {
                    "type": "trace",
                    "trace_id": trace_id_2,
                    "span_id": "2" + uuid.uuid4().hex[:15],
                },
            },
        }

        create_feedback_issue(
            feedback_data, project_2, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
        )

        # Store the replay with all trace IDs
        self.store_replay(dt=dt_1, segment_id=0, trace_ids=[trace_id_1])
        self.store_replay(dt=dt_2, segment_id=1, trace_ids=[trace_id_2])

        data = [
            {
                "type": 5,
                "timestamp": dt_1.timestamp() * 1000 + 3000,
                "data": {
                    "tag": "breadcrumb",
                    "payload": {"category": "console", "message": "hello"},
                },
            },
        ]
        self.save_recording_segment(0, json.dumps(data).encode())

        response = rpc_get_replay_summary_logs(
            self.project.id,
            self.replay_id,
            1,
        )

        logs = response["logs"]
        assert len(logs) == 3

        # Verify that regular error event is included
        assert "ValueError" in logs[0]
        assert "Invalid input" in logs[0]
        assert "User experienced an error" in logs[0]

        assert "hello" in logs[1]

        # Verify that feedback event is included
        assert "Great website" in logs[2]
        assert "User submitted feedback" in logs[2]

    @patch("sentry.replays.usecases.summarize.fetch_feedback_details")
    def test_rpc_with_trace_errors_duplicate_feedback(
        self, mock_fetch_feedback_details: MagicMock
    ) -> None:
        """Test that duplicate feedback events are filtered.
        Duplicates may happen when the replay has a feedback breadcrumb,
        and the feedback is also returned from the Snuba query for trace-connected errors."""

        now = datetime.now(UTC)
        feedback_event_id = uuid.uuid4().hex
        feedback_event_id_2 = uuid.uuid4().hex
        trace_id = uuid.uuid4().hex
        trace_id_2 = uuid.uuid4().hex

        # Create feedback event - issuePlatform dataset
        feedback_data: dict[str, Any] = {
            "type": "feedback",
            "event_id": feedback_event_id,
            "timestamp": (now - timedelta(minutes=3)).timestamp(),
            "contexts": {
                "feedback": {
                    "contact_email": "test@example.com",
                    "name": "Test User",
                    "message": "Great website",
                    "replay_id": self.replay_id,
                    "url": "https://example.com",
                },
                "trace": {
                    "type": "trace",
                    "trace_id": trace_id,
                    "span_id": "1" + uuid.uuid4().hex[:15],
                },
            },
        }

        # Create another feedback event - issuePlatform dataset
        feedback_data_2: dict[str, Any] = {
            "type": "feedback",
            "event_id": feedback_event_id_2,
            "timestamp": (now - timedelta(minutes=2)).timestamp(),
            "contexts": {
                "feedback": {
                    "contact_email": "test2@example.com",
                    "name": "Test User 2",
                    "message": "Broken website",
                    "replay_id": self.replay_id,
                    "url": "https://example.com",
                },
                "trace": {
                    "type": "trace",
                    "trace_id": trace_id_2,
                    "span_id": "1" + uuid.uuid4().hex[:15],
                },
            },
        }

        create_feedback_issue(
            feedback_data, self.project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
        )
        create_feedback_issue(
            feedback_data_2, self.project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
        )

        self.store_replay(dt=now - timedelta(minutes=10), segment_id=0, trace_ids=[trace_id])
        self.store_replay(dt=now - timedelta(minutes=1), segment_id=1, trace_ids=[trace_id_2])

        # mock SDK feedback event with same event_id as the first feedback event
        data = [
            {
                "type": 5,
                "timestamp": float((now - timedelta(minutes=3)).timestamp()),
                "data": {
                    "tag": "breadcrumb",
                    "payload": {
                        "category": "sentry.feedback",
                        "data": {"feedbackId": feedback_event_id},
                    },
                },
            },
        ]
        self.save_recording_segment(0, json.dumps(data).encode())

        # Mock fetch_feedback_details to return a dup of the first feedback event.
        # In prod this is from nodestore. We had difficulties writing to nodestore in tests.
        mock_fetch_feedback_details.return_value = EventDict(
            id=feedback_event_id,
            title="User Feedback",
            message=feedback_data["contexts"]["feedback"]["message"],
            timestamp=float(feedback_data["timestamp"]),
            category="feedback",
        )

        response = rpc_get_replay_summary_logs(
            self.project.id,
            self.replay_id,
            1,
        )

        logs = response["logs"]

        # Verify that only the unique feedback logs are included
        assert len(logs) == 2
        assert "User submitted feedback" in logs[0]
        assert "Great website" in logs[0]
        assert "User submitted feedback" in logs[1]
        assert "Broken website" in logs[1]

    def test_rpc_mobile_replay_navigation(self) -> None:
        """Test that mobile replays are correctly detected and navigation events return log messages."""
        now = datetime.now(UTC)

        # Store a mobile replay with android platform
        self.store_replay(dt=now, platform="android")

        # Create segment data with a navigation event
        data = [
            {
                "type": 5,
                "timestamp": float(now.timestamp() * 1000),
                "data": {
                    "tag": "breadcrumb",
                    "payload": {
                        "timestamp": float(now.timestamp()),
                        "type": "default",
                        "category": "navigation",
                        "data": {
                            "from": "/home",
                            "to": "/profile",
                        },
                    },
                },
            },
        ]
        self.save_recording_segment(0, json.dumps(data).encode())

        response = rpc_get_replay_summary_logs(
            self.project.id,
            self.replay_id,
            1,
        )

        logs = response["logs"]
        assert len(logs) == 1
        assert "User navigated to: /profile" in logs[0]
        assert str(float(now.timestamp() * 1000)) in logs[0]

    def test_rpc_web_replay_navigation(self) -> None:
        """Test that web replays do not return navigation log messages."""
        now = datetime.now(UTC)

        # Store a web replay with javascript platform (default)
        self.store_replay(dt=now, platform="javascript")

        # Create segment data with a navigation event
        data = [
            {
                "type": 5,
                "timestamp": float(now.timestamp() * 1000),
                "data": {
                    "tag": "breadcrumb",
                    "payload": {
                        "timestamp": float(now.timestamp()),
                        "type": "default",
                        "category": "navigation",
                        "data": {
                            "from": "https://example.com/home",
                            "to": "https://example.com/profile",
                        },
                    },
                },
            },
        ]
        self.save_recording_segment(0, json.dumps(data).encode())

        response = rpc_get_replay_summary_logs(
            self.project.id,
            self.replay_id,
            1,
        )

        logs = response["logs"]
        # Web replays should not include navigation events, so logs should be empty
        assert len(logs) == 0

    def test_rpc_filters_out_events_before_replay_start(self) -> None:
        """Test that both segment events and error events before replay start are filtered out."""
        now = datetime.now(UTC)
        replay_start = now - timedelta(minutes=1)
        trace_id = uuid.uuid4().hex
        span_id = "1" + uuid.uuid4().hex[:15]

        # Create an error that occurred BEFORE replay start (should be filtered)
        early_error_id = uuid.uuid4().hex
        early_error_timestamp = (replay_start - timedelta(minutes=3)).timestamp()
        self.store_event(
            data={
                "event_id": early_error_id,
                "timestamp": early_error_timestamp,
                "exception": {
                    "values": [
                        {
                            "type": "EarlyError",
                            "value": "This happened before replay started",
                        }
                    ]
                },
                "contexts": {
                    "trace": {
                        "type": "trace",
                        "trace_id": trace_id,
                        "span_id": span_id,
                    }
                },
            },
            project_id=self.project.id,
        )

        # Create an error that occurred AFTER replay start (should be included)
        late_error_id = uuid.uuid4().hex
        late_error_timestamp = (replay_start + timedelta(minutes=2)).timestamp()
        self.store_event(
            data={
                "event_id": late_error_id,
                "timestamp": late_error_timestamp,
                "exception": {
                    "values": [
                        {
                            "type": "LateError",
                            "value": "This happened after replay started",
                        }
                    ]
                },
                "contexts": {
                    "trace": {
                        "type": "trace",
                        "trace_id": trace_id,
                        "span_id": span_id,
                    }
                },
            },
            project_id=self.project.id,
        )

        self.store_replay(dt=replay_start, segment_id=0, error_ids=[early_error_id, late_error_id])

        data = [
            {
                "type": 5,
                "timestamp": float((replay_start - timedelta(minutes=2)).timestamp() * 1000),
                "data": {
                    "tag": "breadcrumb",
                    "payload": {
                        "category": "console",
                        "message": "hello",
                    },
                },
            },
            {
                "type": 5,
                "timestamp": float((replay_start + timedelta(minutes=3)).timestamp() * 1000),
                "data": {
                    "tag": "breadcrumb",
                    "payload": {
                        "category": "console",
                        "message": "world",
                    },
                },
            },
        ]
        self.save_recording_segment(0, json.dumps(data).encode())

        response = rpc_get_replay_summary_logs(
            self.project.id,
            self.replay_id,
            1,
        )

        logs = response["logs"]
        assert len(logs) == 2

        # Should include the late error and the "world" console message
        assert "LateError" in logs[0]
        assert "This happened after replay started" in logs[0]
        assert "world" in logs[1]

        # Should NOT include the early error or "hello" console message
        assert not any("EarlyError" in log for log in logs)
        assert not any("This happened before replay started" in log for log in logs)
        assert not any("hello" in log for log in logs)
