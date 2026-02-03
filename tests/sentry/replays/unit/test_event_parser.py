from typing import Any
from unittest import mock

import pytest

from sentry.replays.usecases.ingest.event_parser import (
    EventContext,
    EventType,
    HighlightedEventsBuilder,
    _get_testid,
    _parse_classes,
    as_trace_item,
    as_trace_item_context,
    parse_events,
    parse_multiclick_event,
    set_if,
    which,
)
from sentry.utils import json


def test_highlighted_event_builder_canvas_sizes() -> None:
    event = {"type": 3, "data": {"source": 9, "id": 2440, "type": 0, "commands": [{"a": "b"}]}}

    builder = HighlightedEventsBuilder()
    builder.add(which(event), event, sampled=True)
    assert len(builder.result.canvas_sizes) == 1
    assert builder.result.canvas_sizes[0] == len(json.dumps(event))

    # Not sampled.
    builder = HighlightedEventsBuilder()
    builder.add(which(event), event, sampled=False)
    assert len(builder.result.canvas_sizes) == 0


def test_parse_highlighted_events_mutation_events() -> None:
    event = {
        "type": 5,
        "data": {
            "tag": "breadcrumb",
            "payload": {"category": "replay.mutations", "data": {"count": 1738}},
        },
    }
    builder = HighlightedEventsBuilder()
    builder.add(which(event), event, sampled=True)
    result = builder.result
    assert len(result.mutation_events) == 1
    assert result.mutation_events[0].payload == event["data"]["payload"]  # type: ignore[index]

    # Not sampled.
    builder = HighlightedEventsBuilder()
    builder.add(which(event), event, sampled=False)
    result = builder.result
    assert len(result.mutation_events) == 0


def test_parse_highlighted_events_options_events() -> None:
    event = {
        "data": {
            "payload": {
                "blockAllMedia": True,
                "errorSampleRate": 0,
                "maskAllInputs": True,
                "maskAllText": True,
                "networkCaptureBodies": True,
                "networkDetailHasUrls": False,
                "networkRequestHasHeaders": True,
                "networkResponseHasHeaders": True,
                "sessionSampleRate": 1,
                "useCompression": False,
                "useCompressionOption": True,
            },
            "tag": "options",
        },
        "timestamp": 1680009712.507,
        "type": 5,
    }
    builder = HighlightedEventsBuilder()
    builder.add(which(event), event, sampled=True)
    result = builder.result
    assert len(result.options_events) == 1
    assert result.options_events[0] == event

    # Not sampled.
    builder = HighlightedEventsBuilder()
    builder.add(which(event), event, sampled=False)
    result = builder.result
    assert len(result.options_events) == 0


def test_parse_highlighted_events_hydration_errors() -> None:
    event = {
        "type": 5,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "category": "replay.hydrate-error",
                "timestamp": 1.0,
                "data": {"url": "https://sentry.io"},
            },
        },
    }
    builder = HighlightedEventsBuilder()
    builder.add(which(event), event, sampled=False)
    result = builder.result
    assert len(result.hydration_errors) == 1
    assert result.hydration_errors[0].url == event["data"]["payload"]["data"]["url"]  # type: ignore[index]
    assert result.hydration_errors[0].timestamp == event["data"]["payload"]["timestamp"]  # type: ignore[index]


def test_parse_highlighted_events_hydration_errors_missing_data_key() -> None:
    event = {
        "type": 5,
        "data": {
            "tag": "breadcrumb",
            "payload": {"category": "replay.hydrate-error", "timestamp": 1.0},
        },
    }
    builder = HighlightedEventsBuilder()
    builder.add(which(event), event, sampled=False)
    result = builder.result
    assert len(result.hydration_errors) == 1
    assert result.hydration_errors[0].url is None
    assert result.hydration_errors[0].timestamp == event["data"]["payload"]["timestamp"]  # type: ignore[index]


# Request response body sizes parsing.


def test_parse_highlighted_events_payload_sizes_old_format() -> None:
    event = {
        "type": 5,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "resource.xhr",
                "data": {"requestBodySize": 1002, "responseBodySize": 8001},
            },
        },
    }
    builder = HighlightedEventsBuilder()
    builder.add(which(event), event, sampled=True)
    result = builder.result
    assert len(result.request_response_sizes) == 1
    assert result.request_response_sizes[0] == (1002, 8001)


def test_parse_highlighted_events_payload_sizes_old_format_no_response() -> None:
    event = {
        "type": 5,
        "data": {
            "tag": "performanceSpan",
            "payload": {"op": "resource.xhr", "data": {"requestBodySize": 1002}},
        },
    }
    builder = HighlightedEventsBuilder()
    builder.add(which(event), event, sampled=True)
    result = builder.result
    assert len(result.request_response_sizes) == 1
    assert result.request_response_sizes[0] == (1002, None)


def test_parse_highlighted_events_payload_sizes_old_format_no_request() -> None:
    event = {
        "type": 5,
        "data": {
            "tag": "performanceSpan",
            "payload": {"op": "resource.xhr", "data": {"responseBodySize": 8001}},
        },
    }
    builder = HighlightedEventsBuilder()
    builder.add(which(event), event, sampled=True)
    result = builder.result
    assert len(result.request_response_sizes) == 1
    assert result.request_response_sizes[0] == (None, 8001)


def test_parse_highlighted_events_payload_sizes_old_format_nothing() -> None:
    event = {
        "type": 5,
        "data": {"tag": "performanceSpan", "payload": {"op": "resource.xhr", "data": {}}},
    }
    builder = HighlightedEventsBuilder()
    builder.add(which(event), event, sampled=True)
    result = builder.result
    assert len(result.request_response_sizes) == 0


def test_parse_highlighted_events_payload_sizes_new_format() -> None:
    event = {
        "type": 5,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "resource.fetch",
                "data": {"request": {"size": 5}, "response": {"size": 22}},
            },
        },
    }
    builder = HighlightedEventsBuilder()
    builder.add(which(event), event, sampled=True)
    result = builder.result
    assert len(result.request_response_sizes) == 1
    assert result.request_response_sizes[0] == (5, 22)


def test_parse_highlighted_events_payload_sizes_new_format_no_response() -> None:
    event = {
        "type": 5,
        "data": {
            "tag": "performanceSpan",
            "payload": {"op": "resource.fetch", "data": {"request": {"size": 5}}},
        },
    }
    builder = HighlightedEventsBuilder()
    builder.add(which(event), event, sampled=True)
    result = builder.result
    assert len(result.request_response_sizes) == 1
    assert result.request_response_sizes[0] == (5, None)


def test_parse_highlighted_events_payload_sizes_new_format_no_request() -> None:
    event = {
        "type": 5,
        "data": {
            "tag": "performanceSpan",
            "payload": {"op": "resource.fetch", "data": {"response": {"size": 5}}},
        },
    }
    builder = HighlightedEventsBuilder()
    builder.add(which(event), event, sampled=True)
    result = builder.result
    assert len(result.request_response_sizes) == 1
    assert result.request_response_sizes[0] == (None, 5)


def test_parse_highlighted_events_payload_sizes_new_format_nothing() -> None:
    event = {
        "type": 5,
        "data": {"tag": "performanceSpan", "payload": {"op": "resource.fetch"}},
    }
    builder = HighlightedEventsBuilder()
    builder.add(which(event), event, sampled=True)
    result = builder.result
    assert len(result.request_response_sizes) == 0


def test_parse_highlighted_events_payload_sizes_invalid_op() -> None:
    event = {
        "type": 5,
        "data": {
            "tag": "performanceSpan",
            "payload": {"op": "a", "data": {"response": {"size": 5}}},
        },
    }
    builder = HighlightedEventsBuilder()
    builder.add(which(event), event, sampled=True)
    result = builder.result
    assert len(result.request_response_sizes) == 0


def test_parse_highlighted_events_with_tap_event() -> None:
    event = {
        "type": 5,
        "timestamp": 1758523985314,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "type": "default",
                "timestamp": 1758523985.314,
                "category": "ui.tap",
                "message": "send_user_feedback",
                "data": {
                    "view.class": "androidx.appcompat.widget.AppCompatButton",
                    "view.id": "send_user_feedback",
                },
            },
        },
    }

    builder = HighlightedEventsBuilder()
    builder.add(which(event), event, sampled=True)
    assert len(builder.result.tap_events) == 1
    assert builder.result.tap_events[0].timestamp == int(1758523985.314)
    assert builder.result.tap_events[0].message == "send_user_feedback"
    assert builder.result.tap_events[0].view_class == "androidx.appcompat.widget.AppCompatButton"
    assert builder.result.tap_events[0].view_id == "send_user_feedback"


def test_parse_highlighted_events_with_tap_event_missing_fields() -> None:
    event = {
        "type": 5,
        "timestamp": 1758523985314,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "type": "default",
                "timestamp": 1758523985.314,
                "category": "ui.tap",
                "message": "send_user_feedback",
                "data": {},
            },
        },
    }

    builder = HighlightedEventsBuilder()
    builder.add(which(event), event, sampled=True)
    assert len(builder.result.tap_events) == 1
    assert builder.result.tap_events[0].timestamp == int(1758523985.314)
    assert builder.result.tap_events[0].message == "send_user_feedback"
    assert builder.result.tap_events[0].view_class == ""
    assert builder.result.tap_events[0].view_id == ""


# Click parsing.


def test_parse_highlighted_events_click_events() -> None:
    event = {
        "type": 5,
        "timestamp": 1674298825,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "timestamp": 1674298825.403,
                "type": "default",
                "category": "ui.click",
                "message": "div#hello.hello.world",
                "data": {
                    "nodeId": 1,
                    "node": {
                        "id": 1,
                        "tagName": "div",
                        "attributes": {
                            "id": "hello",
                            "class": "hello world",
                            "aria-label": "test",
                            "role": "button",
                            "alt": "1",
                            "data-testid": "2",
                            "title": "3",
                            "data-sentry-component": "SignUpForm",
                        },
                        "textContent": "Hello, world!",
                    },
                },
            },
        },
    }

    builder = HighlightedEventsBuilder()
    builder.add(which(event), event, sampled=False)
    user_actions = builder.result
    assert len(user_actions.click_events) == 1
    assert user_actions.click_events[0].node_id == 1
    assert user_actions.click_events[0].tag == "div"
    assert user_actions.click_events[0].id == "hello"
    assert user_actions.click_events[0].classes == ["hello", "world"]
    assert user_actions.click_events[0].text == "Hello, world!"
    assert user_actions.click_events[0].role == "button"
    assert user_actions.click_events[0].alt == "1"
    assert user_actions.click_events[0].testid == "2"
    assert user_actions.click_events[0].aria_label == "test"
    assert user_actions.click_events[0].title == "3"
    assert user_actions.click_events[0].component_name == "SignUpForm"
    assert user_actions.click_events[0].is_dead == 0
    assert user_actions.click_events[0].is_rage == 0
    assert user_actions.click_events[0].timestamp == 1674298825


def test_parse_highlighted_events_click_events_missing_node() -> None:
    event = {
        "type": 5,
        "timestamp": 1674298825,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "timestamp": 1674298825.403,
                "type": "default",
                "category": "ui.click",
                "message": "div#hello.hello.world",
                "data": {"nodeId": 1},
            },
        },
    }

    builder = HighlightedEventsBuilder()
    builder.add(which(event), event, sampled=False)
    assert len(builder.result.click_events) == 0


def test_parse_highlighted_events_click_event_str_payload() -> None:
    event = {"type": 5, "data": {"tag": "breadcrumb", "payload": "hello world"}}
    builder = HighlightedEventsBuilder()
    builder.add(which(event), event, sampled=False)
    result = builder.result
    assert len(result.click_events) == 0


def test_parse_highlighted_events_click_event_missing_node() -> None:
    event = {
        "type": 5,
        "data": {
            "tag": "breadcrumb",
            "payload": {"category": "ui.click", "message": "div#hello.hello.world"},
        },
    }

    builder = HighlightedEventsBuilder()
    builder.add(which(event), event, sampled=False)
    result = builder.result
    assert len(result.click_events) == 0


def test_parse_highlighted_events_click_event_dead_rage() -> None:
    time_after_click_ms = 7000.0
    event1 = {
        "type": 5,
        "timestamp": 1674291701348,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "timestamp": 1.1,
                "type": "default",
                "category": "ui.slowClickDetected",
                "message": "div.container > div#root > div > ul > div",
                "data": {
                    "endReason": "timeout",
                    "timeafterclickms": time_after_click_ms,
                    "nodeId": 59,
                    "url": "https://www.sentry.io",
                    "node": {
                        "id": 59,
                        "tagName": "a",
                        "attributes": {
                            "id": "id",
                            "class": "class1 class2",
                            "role": "button",
                            "aria-label": "test",
                            "alt": "1",
                            "data-testid": "2",
                            "title": "3",
                            "data-sentry-component": "SignUpForm",
                        },
                        "textContent": "text",
                    },
                },
            },
        },
    }
    event2 = {
        "type": 5,
        "timestamp": 1674291701348,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "timestamp": 1.1,
                "type": "default",
                "category": "ui.slowClickDetected",
                "message": "div.container > div#root > div > ul > div",
                "data": {
                    "clickcount": 5,
                    "endReason": "timeout",
                    "timeafterclickms": time_after_click_ms,
                    "nodeId": 59,
                    "url": "https://www.sentry.io",
                    "node": {
                        "id": 59,
                        "tagName": "a",
                        "attributes": {
                            "id": "id",
                            "class": "class1 class2",
                            "role": "button",
                            "aria-label": "test",
                            "alt": "1",
                            "data-testid": "2",
                            "title": "3",
                            "data-sentry-component": "SignUpForm",
                        },
                        "textContent": "text",
                    },
                },
            },
        },
    }
    # New style slowClickDetected payload.
    event3 = {
        "type": 5,
        "timestamp": 1674291701348,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "timestamp": 1.1,
                "type": "default",
                "category": "ui.slowClickDetected",
                "message": "div.container > div#root > div > ul > div",
                "data": {
                    "url": "https://www.sentry.io",
                    "clickCount": 5,
                    "endReason": "timeout",
                    "timeAfterClickMs": time_after_click_ms,
                    "nodeId": 59,
                    "node": {
                        "id": 59,
                        "tagName": "a",
                        "attributes": {
                            "id": "id",
                            "class": "class1 class2",
                            "role": "button",
                            "aria-label": "test",
                            "alt": "1",
                            "data-testid": "2",
                            "title": "3",
                            "data-sentry-component": "SignUpForm",
                        },
                        "textContent": "text",
                    },
                },
            },
        },
    }

    builder = HighlightedEventsBuilder()
    builder.add(which(event1), event1, sampled=False)
    builder.add(which(event2), event2, sampled=False)
    builder.add(which(event3), event3, sampled=False)
    result = builder.result
    assert len(result.click_events) == 3
    assert result.click_events[0].node_id == 59
    assert result.click_events[0].tag == "a"
    assert result.click_events[0].id == "id"
    assert result.click_events[0].classes == ["class1", "class2"]
    assert result.click_events[0].text == "text"
    assert result.click_events[0].aria_label == "test"
    assert result.click_events[0].role == "button"
    assert result.click_events[0].alt == "1"
    assert result.click_events[0].testid == "2"
    assert result.click_events[0].title == "3"
    assert result.click_events[0].component_name == "SignUpForm"
    assert result.click_events[0].is_dead == 1
    assert result.click_events[0].is_rage == 0
    assert result.click_events[0].timestamp == 1

    # Second slow click had more than 2 clicks which makes it a rage+dead combo.
    action = result.click_events[1]
    assert action.is_dead == 1
    assert action.is_rage == 1

    # Third slow click had more than 2 clicks which makes it a rage+dead combo.
    action = result.click_events[2]
    assert action.is_dead == 1
    assert action.is_rage == 1


def test_parse_highlighted_events_multiclick_events() -> None:
    """Test that multiclick events are parsed correctly."""
    event1 = {
        "type": 5,
        "timestamp": 1674291701348,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "timestamp": 1.1,
                "type": "default",
                "category": "ui.multiClick",
                "message": "body > button#mutationButtonImmediately",
                "data": {
                    "clickCount": 4,
                    "url": "http://sentry-test.io/index.html",
                    "metric": True,
                    "nodeId": 59,
                    "node": {
                        "id": 59,
                        "tagName": "a",
                        "attributes": {"id": "id"},
                        "textContent": "Click me!",
                    },
                },
            },
        },
    }

    event2 = {
        "type": 5,
        "timestamp": 1674291701348,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "timestamp": 1.1,
                "type": "default",
                "category": "ui.multiClick",
                "message": "body > button#mutationButtonImmediately",
                "data": {
                    "clickCount": 5,
                    "url": "http://sentry-test.io/index.html",
                    "metric": True,
                    "nodeId": 60,
                    "node": {
                        "id": 60,
                        "tagName": "a",
                        "attributes": {"id": "id"},
                        "textContent": "Click me!",
                    },
                },
            },
        },
    }

    # This is a slow click, not multiclick, and should not be added to multiclick_events in the builder
    event3 = {
        "type": 5,
        "timestamp": 1674291701348,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "timestamp": 1.1,
                "type": "default",
                "category": "ui.slowClickDetected",
                "message": "div.container > div#root > div > ul > div",
                "data": {
                    "url": "https://www.sentry.io",
                    "clickCount": 5,
                    "endReason": "timeout",
                    "timeAfterClickMs": 7000.0,
                    "nodeId": 61,
                    "node": {
                        "id": 61,
                        "tagName": "a",
                        "attributes": {
                            "id": "id",
                            "class": "class1 class2",
                            "role": "button",
                            "aria-label": "test",
                            "alt": "1",
                            "data-testid": "2",
                            "title": "3",
                            "data-sentry-component": "SignUpForm",
                        },
                        "textContent": "text",
                    },
                },
            },
        },
    }

    builder = HighlightedEventsBuilder()
    builder.add(which(event1), event1, sampled=False)
    builder.add(which(event2), event2, sampled=False)
    builder.add(which(event3), event3, sampled=False)
    result = builder.result
    assert len(result.multiclick_events) == 2

    multiclick1 = result.multiclick_events[0]
    assert multiclick1.click_event.node_id == 59
    assert multiclick1.click_event.id == "id"
    assert multiclick1.click_event.text == "Click me!"
    assert multiclick1.click_event.is_dead == 0
    assert multiclick1.click_event.is_rage == 0
    assert multiclick1.click_count == 4
    assert multiclick1.click_event.timestamp == 1

    multiclick2 = result.multiclick_events[1]
    assert multiclick2.click_event.node_id == 60
    assert multiclick2.click_event.id == "id"
    assert multiclick2.click_event.text == "Click me!"
    assert multiclick2.click_event.is_dead == 0
    assert multiclick2.click_event.is_rage == 0
    assert multiclick2.click_count == 5
    assert multiclick2.click_event.timestamp == 1


def test_parse_multiclick_event() -> None:
    """Test that multiclick events are parsed correctly."""
    payload = {
        "timestamp": 1.1,
        "type": "default",
        "category": "ui.multiClick",
        "message": "body > button#mutationButtonImmediately",
        "data": {
            "clickCount": 5,
            "url": "http://sentry-test.io/index.html",
            "metric": True,
            "nodeId": 59,
            "node": {
                "id": 59,
                "tagName": "a",
                "attributes": {"id": "id"},
                "textContent": "Click me!",
            },
        },
    }
    result = parse_multiclick_event(payload)
    assert result is not None
    assert result.click_count == 5
    assert result.click_event.node_id == 59
    assert result.click_event.tag == "a"
    assert result.click_event.id == "id"
    assert result.click_event.text == "Click me!"
    assert result.click_event.is_dead == 0
    assert result.click_event.is_rage == 0


def test_parse_multiclick_event_missing_node() -> None:
    """Test parse_multiclick_event returns None when node is missing or invalid."""
    payload1 = {
        "timestamp": 1.1,
        "type": "default",
        "category": "ui.multiClick",
        "message": "div#test-button.btn.primary",
        "data": {
            "nodeId": 1,
            "clickCount": 3,
            # Missing "node" field
        },
    }
    assert parse_multiclick_event(payload1) is None

    payload2 = {
        "timestamp": 1.1,
        "type": "default",
        "category": "ui.multiClick",
        "message": "div#test-button.btn.primary",
        "data": {
            "nodeId": 1,
            "clickCount": 3,
            "node": {
                "id": -1,  # Invalid negative ID
                "tagName": "div",
                "attributes": {"id": "test-button"},
                "textContent": "Click me!",
            },
        },
    }
    assert parse_multiclick_event(payload2) is None

    payload3 = {
        "timestamp": 1.1,
        "type": "default",
        "category": "ui.multiClick",
        "message": "div#test-button.btn.primary",
        "data": {
            "nodeId": 1,
            "clickCount": 3,
            "node": "not-a-dict",  # Invalid node type
        },
    }
    assert parse_multiclick_event(payload3) is None


def test_emit_click_negative_node_id() -> None:
    event = {
        "type": 5,
        "timestamp": 1674298825,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "timestamp": 1674298825.403,
                "type": "default",
                "category": "ui.click",
                "message": "div#hello.hello.world",
                "data": {
                    "nodeId": 1,
                    "node": {
                        "id": -1,
                        "tagName": "div",
                        "attributes": {
                            "id": "hello",
                            "class": "hello world",
                            "aria-label": "test",
                            "role": "button",
                            "alt": "1",
                            "data-testid": "2",
                            "title": "3",
                            "data-sentry-component": "SignUpForm",
                        },
                        "textContent": "Hello, world!",
                    },
                },
            },
        },
    }

    builder = HighlightedEventsBuilder()
    builder.add(which(event), event, sampled=False)
    result = builder.result
    assert len(result.click_events) == 0


# Misc helper tests


def test_get_testid() -> None:
    # Assert each test-id permutation is extracted.
    assert _get_testid({"testId": "123"}) == "123"
    assert _get_testid({"data-testid": "123"}) == "123"
    assert _get_testid({"data-test-id": "123"}) == "123"

    # Assert no test-id is parsed as empty string
    assert _get_testid({}) == ""

    # testId takes precedence.
    assert _get_testid({"testId": "123", "data-testid": "456", "data-test-id": "456"}) == "123"

    # data-testid takes precedence.
    assert _get_testid({"data-testid": "123", "data-test-id": ""}) == "123"

    # data-test-id is the fallback case.
    assert _get_testid({"testId": "", "data-testid": "", "data-test-id": "456"}) == "456"
    assert _get_testid({"data-testid": "", "data-test-id": "456"}) == "456"
    assert _get_testid({"data-test-id": "456"}) == "456"

    # Defaults to empty string.
    assert _get_testid({}) == ""


def test_parse_classes() -> None:
    assert _parse_classes("") == []
    assert _parse_classes("   ") == []
    assert _parse_classes("  a b ") == ["a", "b"]
    assert _parse_classes("a  ") == ["a"]
    assert _parse_classes("  a") == ["a"]


def test_which() -> None:
    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {"tag": "breadcrumb", "payload": {"category": "ui.click"}},
    }
    assert which(event) == EventType.CLICK

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "category": "ui.slowClickDetected",
                "data": {
                    "clickCount": 4,
                    "endReason": "timeout",
                    "timeAfterClickMs": 7000,
                    "node": {"tagName": "button"},
                },
            },
        },
    }
    assert which(event) == EventType.DEAD_CLICK

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "category": "ui.slowClickDetected",
                "data": {
                    "clickCount": 5,
                    "endReason": "timeout",
                    "timeAfterClickMs": 7000,
                    "node": {"tagName": "button"},
                },
            },
        },
    }
    assert which(event) == EventType.RAGE_CLICK

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "category": "ui.multiClick",
                "data": {
                    "clickCount": 7,
                    "metric": True,
                    "node": {"tagName": "button"},
                    "nodeId": 59,
                    "url": "http://sentry-test.io/index.html",
                },
            },
        },
    }
    assert which(event) == EventType.MULTI_CLICK

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "navigation.push",
                "description": "url",
                "startTimestamp": 1752530070.378,
                "endTimestamp": 1752530070.378,
                "data": {},
            },
        },
    }
    assert which(event) == EventType.NAVIGATION_SPAN

    event = {
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "timestamp": 1761671674.977515,
                "type": "default",
                "data": {"to": "UIInputWindowController"},
                "message": "UIInputWindowController",
                "category": "navigation",
                "level": "none",
            },
        },
        "type": 5,
        "timestamp": 1761671674977,
    }
    assert which(event) == EventType.NAVIGATION

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {"tag": "breadcrumb", "payload": {"category": "console"}},
    }
    assert which(event) == EventType.CONSOLE

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {"tag": "breadcrumb", "payload": {"category": "sentry.feedback"}},
    }
    assert which(event) == EventType.FEEDBACK

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {"tag": "breadcrumb", "payload": {"category": "ui.blur"}},
    }
    assert which(event) == EventType.UI_BLUR

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {"tag": "breadcrumb", "payload": {"category": "ui.focus"}},
    }
    assert which(event) == EventType.UI_FOCUS

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {"tag": "performanceSpan", "payload": {"op": "resource.fetch"}},
    }
    assert which(event) == EventType.RESOURCE_FETCH

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {"tag": "performanceSpan", "payload": {"op": "resource.xhr"}},
    }
    assert which(event) == EventType.RESOURCE_XHR

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {
            "tag": "performanceSpan",
            "payload": {"op": "web-vital", "description": "largest-contentful-paint"},
        },
    }
    assert which(event) == EventType.LCP

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {"tag": "breadcrumb", "payload": {"category": "replay.hydrate-error"}},
    }
    assert which(event) == EventType.HYDRATION_ERROR

    event = {
        "type": 5,
        "timestamp": 0.0,
        "data": {"tag": "breadcrumb", "payload": {"category": "replay.mutations"}},
    }
    assert which(event) == EventType.MUTATIONS

    event = {
        "type": 5,
        "timestamp": 1758523985314,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "type": "default",
                "timestamp": 1758523985.314,
                "category": "ui.tap",
                "message": "send_user_feedback",
                "data": {
                    "view.class": "androidx.appcompat.widget.AppCompatButton",
                    "view.id": "send_user_feedback",
                },
            },
        },
    }

    assert which(event) == EventType.TAP

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
    assert which(event) == EventType.DEVICE_BATTERY

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
    assert which(event) == EventType.DEVICE_ORIENTATION

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
    assert which(event) == EventType.DEVICE_CONNECTIVITY

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
    assert which(event) == EventType.SCROLL

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
    assert which(event) == EventType.SWIPE

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
    assert which(event) == EventType.BACKGROUND

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
    assert which(event) == EventType.FOREGROUND

    assert which({}) == EventType.UNKNOWN


@pytest.mark.parametrize(
    "event",
    [
        {},
        {"type": None},
        {"type": "3", "data": 2},
        {"type": "3", "data": {"source": "2"}},
        {"type": "5"},
        {"type": 5},
        {"type": 5, "data": {"tag": "breadcrumb"}},
        {"type": 5, "data": {"tag": "performanceSpan", "payload": {"op": "resource.xhr"}}},
        {
            "type": 5,
            "data": {"tag": "performanceSpan", "payload": {"op": "resource.xhr", "data": "None"}},
        },
        {
            "type": 5,
            "data": {
                "tag": "performanceSpan",
                "payload": {"op": "resource.xhr", "data": {"requestBodySize": "test"}},
            },
        },
        {
            "type": 5,
            "data": {
                "tag": "performanceSpan",
                "payload": {"op": "resource.xhr", "data": {"requestBodySize": None}},
            },
        },
        {
            "type": 5,
            "data": {
                "tag": "performanceSpan",
                "payload": {"op": "resource.xhr", "data": {"request": None}},
            },
        },
        {
            "type": 5,
            "data": {
                "tag": "performanceSpan",
                "payload": {"op": "resource.xhr", "data": {"request": {"size": None}}},
            },
        },
        {
            "type": 5,
            "data": {
                "tag": "performanceSpan",
                "payload": {"op": "resource.xhr", "data": {"request": {"size": "t"}}},
            },
        },
        {
            "type": 5,
            "data": {"tag": "breadcrumb", "payload": {}},
        },
        {
            "type": 5,
            "data": {"tag": "breadcrumb", "payload": {"data": {}}},
        },
        {
            "type": 5,
            "data": {"tag": "breadcrumb", "payload": {"data": {"nodeId": -1, "node": {}}}},
        },
        {
            "type": 5,
            "data": {"tag": "breadcrumb", "payload": {"data": {"nodeId": 0, "node": None}}},
        },
        {
            "type": 5,
            "data": {"tag": "breadcrumb", "payload": {"data": {"nodeId": 0, "node": "t"}}},
        },
    ],
)
def test_parse_highlighted_events_fault_tolerance(event: dict[str, Any]) -> None:
    # If the test raises an exception we fail. All of these events are invalid.
    builder = HighlightedEventsBuilder()
    builder.add(which(event), event, sampled=True)


# Tests for trace item functions


def test_as_trace_item_context_click_event() -> None:
    event = {
        "type": 5,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "timestamp": 1674298825.403,
                "type": "default",
                "category": "ui.click",
                "message": "div#hello.hello.world",
                "data": {
                    "node": {
                        "id": 123,
                        "tagName": "button",
                        "textContent": "Click me!",
                        "attributes": {
                            "id": "submit-btn",
                            "class": "btn primary",
                            "alt": "submit button",
                            "aria-label": "Submit form",
                            "role": "button",
                            "title": "Submit this form",
                            "data-sentry-component": "SubmitButton",
                            "data-testid": "submit-test",
                        },
                    }
                },
                "url": "https://example.com/form",
            },
        },
    }

    result = as_trace_item_context(which(event), event)
    assert result is not None
    assert result["timestamp"] == 1674298825.403
    assert result["attributes"]["category"] == "ui.click"
    assert result["attributes"]["node_id"] == 123
    assert result["attributes"]["tag"] == "button"
    assert result["attributes"]["text"] == "Click me!"
    assert result["attributes"]["is_dead"] is False
    assert result["attributes"]["is_rage"] is False
    assert result["attributes"]["selector"] == "div#hello.hello.world"
    assert result["attributes"]["id"] == "submit-btn"
    assert result["attributes"]["class"] == "btn primary"
    assert result["attributes"]["alt"] == "submit button"
    assert result["attributes"]["aria_label"] == "Submit form"
    assert result["attributes"]["role"] == "button"
    assert result["attributes"]["title"] == "Submit this form"
    assert result["attributes"]["component_name"] == "SubmitButton"
    assert result["attributes"]["testid"] == "submit-test"
    assert result["attributes"]["url"] == "https://example.com/form"
    assert "event_hash" in result and len(result["event_hash"]) == 16


def test_as_trace_item_context_click_event_missing_node() -> None:
    event = {
        "type": 5,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "timestamp": 1674298825.403,
                "type": "default",
                "category": "ui.click",
                "message": "div#hello.hello.world",
                "data": {},
                "url": "https://example.com/form",
            },
        },
    }

    result = as_trace_item_context(which(event), event)
    assert result is None


def test_as_trace_item_context_dead_click_event() -> None:
    event = {
        "type": 5,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "type": "default",
                "category": "ui.slowClickDetected",
                "timestamp": 1674298825.403,
                "message": "button.slow",
                "data": {
                    "endReason": "timeout",
                    "timeAfterClickMs": 7000,
                    "clickCount": 3,
                    "node": {
                        "id": 456,
                        "tagName": "a",
                        "textContent": "Slow button",
                        "attributes": {},
                    },
                },
            },
        },
    }

    result = as_trace_item_context(which(event), event)
    assert result is not None
    assert result["attributes"]["is_dead"] is True
    assert result["attributes"]["is_rage"] is False
    assert "event_hash" in result and len(result["event_hash"]) == 16


def test_as_trace_item_context_rage_click_event() -> None:
    event = {
        "type": 5,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "type": "default",
                "category": "ui.slowClickDetected",
                "timestamp": 1674298825.403,
                "message": "button.slow",
                "data": {
                    "endReason": "timeout",
                    "timeAfterClickMs": 7000,
                    "clickCount": 5,
                    "node": {
                        "id": 456,
                        "tagName": "a",
                        "textContent": "Slow button",
                        "attributes": {},
                    },
                },
            },
        },
    }

    result = as_trace_item_context(which(event), event)
    assert result is not None
    assert result["attributes"]["is_dead"] is True
    assert result["attributes"]["is_rage"] is True
    assert "event_hash" in result and len(result["event_hash"]) == 16


def test_as_trace_item_context_tap_event() -> None:
    event = {
        "type": 5,
        "timestamp": 1758523985314,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "type": "default",
                "timestamp": 1758523985.314,
                "category": "ui.tap",
                "message": "send_user_feedback",
                "data": {
                    "view.class": "androidx.appcompat.widget.AppCompatButton",
                    "view.id": "send_user_feedback",
                },
            },
        },
    }

    result = as_trace_item_context(which(event), event)
    assert result is not None
    assert "event_hash" in result and len(result["event_hash"]) == 16
    assert result["attributes"]["view_id"] == "send_user_feedback"
    assert result["attributes"]["message"] == "send_user_feedback"
    assert result["attributes"]["view_class"] == "androidx.appcompat.widget.AppCompatButton"
    assert result["timestamp"] == 1758523985.314


def test_as_trace_item_context_navigation_event() -> None:
    event = {
        "type": 5,
        "timestamp": 1753710793872,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "timestamp": 1674298825.0,
                "type": "default",
                "category": "navigation",
                "data": {"from": "/old-page", "to": "/new-page"},
            },
        },
    }

    result = as_trace_item_context(which(event), event)
    assert result is not None
    assert result["timestamp"] == 1674298825.0
    assert result["attributes"]["category"] == "navigation"
    assert result["attributes"]["from"] == "/old-page"
    assert result["attributes"]["to"] == "/new-page"
    assert "event_hash" in result and len(result["event_hash"]) == 16


def test_as_trace_item_context_navigation_event_missing_data() -> None:
    event = {
        "type": 5,
        "timestamp": 1753710793872,
        "data": {
            "tag": "breadcrumb",
            "payload": {"timestamp": 1674298825.0, "type": "default", "category": "navigation"},
        },
    }

    result = as_trace_item_context(which(event), event)
    assert result is not None
    assert result["timestamp"] == 1674298825.0
    assert result["attributes"]["category"] == "navigation"
    assert "event_hash" in result and len(result["event_hash"]) == 16


def test_as_trace_item_context_navigation_event_missing_optional_fields() -> None:
    event = {
        "type": 5,
        "timestamp": 1753710793872,
        "data": {
            "tag": "breadcrumb",
            "payload": {
                "timestamp": 1674298825.0,
                "type": "default",
                "category": "navigation",
                "data": {},
            },
        },
    }

    result = as_trace_item_context(which(event), event)
    assert result is not None
    assert result["attributes"]["category"] == "navigation"
    assert "from" not in result["attributes"]
    assert "to" not in result["attributes"]
    assert "event_hash" in result and len(result["event_hash"]) == 16


def test_as_trace_item_context_resource_fetch_event() -> None:
    event = {
        "type": 5,
        "timestamp": 1753710794.0346,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "resource.fetch",
                "startTimestamp": 1674298825.0,
                "endTimestamp": 1674298825.0,
                "description": "https://sentry.io/",
                "data": {
                    "requestBodySize": 1024,
                    "responseBodySize": 2048,
                    "method": "GET",
                    "statusCode": 200,
                },
            },
        },
    }

    result = as_trace_item_context(which(event), event)
    assert result is not None
    assert result["timestamp"] == 1674298825.0
    assert result["attributes"]["category"] == "resource.fetch"
    assert result["attributes"]["request_size"] == 1024
    assert result["attributes"]["response_size"] == 2048
    assert "duration" in result["attributes"]
    assert "event_hash" in result and len(result["event_hash"]) == 16


def test_as_trace_item_context_resource_xhr_event() -> None:
    event = {
        "type": 5,
        "timestamp": 1753710794.0346,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "resource.xhr",
                "startTimestamp": 1674298825.0,
                "endTimestamp": 1674298825.0,
                "description": "https://sentry.io/",
                "data": {
                    "method": "GET",
                    "statusCode": 200,
                    "request": {"size": 512},
                    "response": {"size": 1024},
                },
            },
        },
    }

    result = as_trace_item_context(which(event), event)
    assert result is not None
    assert result["attributes"]["category"] == "resource.xhr"
    assert result["attributes"]["request_size"] == 512
    assert result["attributes"]["response_size"] == 1024
    assert "duration" in result["attributes"]
    assert "event_hash" in result and len(result["event_hash"]) == 16


def test_as_trace_item_context_resource_no_sizes() -> None:
    event = {
        "data": {
            "payload": {
                "startTimestamp": 1674298825.0,
                "endTimestamp": 1674298825.0,
                "description": "https://sentry.io/",
                "data": {"method": "GET", "statusCode": 200},
            }
        }
    }

    result = as_trace_item_context(EventType.RESOURCE_FETCH, event)
    assert result is not None
    assert result["attributes"]["category"] == "resource.fetch"
    assert "request_size" not in result["attributes"]
    assert "response_size" not in result["attributes"]
    assert "duration" in result["attributes"]
    assert "event_hash" in result and len(result["event_hash"]) == 16


def test_as_trace_item_context_resource_script_event() -> None:
    event = {
        "type": 5,
        "timestamp": 1753710794.0346,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "resource.script",
                "startTimestamp": 1674298825.0,
                "endTimestamp": 1674298825.0,
                "description": "https://sentry.io/",
                "data": {
                    "size": 10,
                    "statusCode": 200,
                    "decodedBodySize": 45,
                    "encodedBodySize": 55,
                },
            },
        },
    }

    result = as_trace_item_context(which(event), event)
    assert result is not None
    assert result["attributes"]["category"] == "resource.script"
    assert result["attributes"]["size"] == 10
    assert result["attributes"]["statusCode"] == 200
    assert result["attributes"]["decodedBodySize"] == 45
    assert result["attributes"]["encodedBodySize"] == 55
    assert "duration" in result["attributes"]
    assert "event_hash" in result and len(result["event_hash"]) == 16


def test_as_trace_item_context_resource_script_event_missing_data() -> None:
    event = {
        "type": 5,
        "timestamp": 1753710794.0346,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "resource.script",
                "startTimestamp": 1674298825.0,
                "endTimestamp": 1674298825.0,
                "description": "https://sentry.io/",
            },
        },
    }

    result = as_trace_item_context(which(event), event)
    assert result is not None
    assert result["attributes"]["category"] == "resource.script"
    assert "duration" in result["attributes"]
    assert "event_hash" in result and len(result["event_hash"]) == 16


def test_as_trace_item_context_resource_image_event() -> None:
    event = {
        "type": 5,
        "timestamp": 1753710794.0346,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "resource.img",
                "startTimestamp": 1674298825.0,
                "endTimestamp": 1674298825.0,
                "description": "https://sentry.io/",
                "data": {
                    "size": 10,
                    "statusCode": 200,
                    "decodedBodySize": 45,
                    "encodedBodySize": 55,
                },
            },
        },
    }

    result = as_trace_item_context(which(event), event)
    assert result is not None
    assert result["attributes"]["category"] == "resource.img"
    assert result["attributes"]["size"] == 10
    assert result["attributes"]["statusCode"] == 200
    assert result["attributes"]["decodedBodySize"] == 45
    assert result["attributes"]["encodedBodySize"] == 55
    assert "duration" in result["attributes"]
    assert "event_hash" in result and len(result["event_hash"]) == 16


def test_as_trace_item_context_lcp_event() -> None:
    event = {
        "type": 5,
        "timestamp": 1753712471.43,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "web-vital",
                "description": "largest-contentful-paint",
                "startTimestamp": 1674298825.0,
                "endTimestamp": 1674298825.0,
                "data": {"rating": "good", "size": 1024, "value": 1500},
            },
        },
    }

    result = as_trace_item_context(which(event), event)
    assert result is not None
    assert result["timestamp"] == 1674298825.0
    assert result["attributes"]["category"] == "web-vital.lcp"
    assert result["attributes"]["duration"] == 0
    assert result["attributes"]["rating"] == "good"
    assert result["attributes"]["size"] == 1024
    assert result["attributes"]["value"] == 1500
    assert "event_hash" in result and len(result["event_hash"]) == 16


def test_as_trace_item_context_cls_event() -> None:
    event = {
        "type": 5,
        "timestamp": 1753467516.4146557,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "web-vital",
                "description": "cumulative-layout-shift",
                "startTimestamp": 1753467516.4146557,
                "endTimestamp": 1753467516.4146557,
                "data": {
                    "value": 0.6558277147341711,
                    "size": 0.6558277147341711,
                    "rating": "poor",
                    "nodeIds": [1239, 1072, 1244, 1243, 891],
                    "attributions": [
                        {"value": 0.6558277147341711, "nodeIds": [1239, 1072, 1244, 1243, 891]}
                    ],
                },
            },
        },
    }
    result = as_trace_item_context(which(event), event)
    assert result is not None
    assert result["attributes"]["category"] == "web-vital.cls"
    assert result["attributes"]["duration"] == 0
    assert result["attributes"]["rating"] == "poor"
    assert result["attributes"]["size"] == 0.6558277147341711
    assert result["attributes"]["value"] == 0.6558277147341711
    assert "event_hash" in result and len(result["event_hash"]) == 16


def test_as_trace_item_context_hydration_error() -> None:
    event = {
        "data": {
            "payload": {"timestamp": 1674298825.0, "data": {"url": "https://example.com/page"}}
        }
    }

    result = as_trace_item_context(EventType.HYDRATION_ERROR, event)
    assert result is not None
    assert result["timestamp"] == 1674298825.0
    assert result["attributes"]["category"] == "replay.hydrate-error"
    assert result["attributes"]["url"] == "https://example.com/page"
    assert "event_hash" in result and len(result["event_hash"]) == 16


def test_as_trace_item_context_hydration_error_missing_data_key() -> None:
    event = {"data": {"payload": {"timestamp": 1674298825.0}}}

    result = as_trace_item_context(EventType.HYDRATION_ERROR, event)
    assert result is not None
    assert result["timestamp"] == 1674298825.0
    assert result["attributes"]["category"] == "replay.hydrate-error"
    assert result["attributes"]["url"] == ""
    assert "event_hash" in result and len(result["event_hash"]) == 16


def test_as_trace_item_context_mutations() -> None:
    event = {"timestamp": 1674298825000, "data": {"payload": {"data": {"count": 42}}}}

    result = as_trace_item_context(EventType.MUTATIONS, event)
    assert result is not None
    assert result["timestamp"] == 1674298825000
    assert result["attributes"]["category"] == "replay.mutations"
    assert result["attributes"]["count"] == 42
    assert "event_hash" in result and len(result["event_hash"]) == 16


def test_as_trace_item_context_options() -> None:
    event = {
        "type": 5,
        "timestamp": 1753710752516,
        "data": {
            "tag": "options",
            "payload": {
                "shouldRecordCanvas": True,
                "sessionSampleRate": 0.1,
                "errorSampleRate": 1.0,
                "useCompressionOption": False,
                "blockAllMedia": True,
                "maskAllText": False,
                "maskAllInputs": True,
                "useCompression": False,
                "networkDetailHasUrls": True,
                "networkCaptureBodies": False,
                "networkRequestHasHeaders": True,
                "networkResponseHasHeaders": False,
            },
        },
    }

    result = as_trace_item_context(which(event), event)
    assert result is not None
    assert result["timestamp"] == 1753710752.516  # timestamp is divided by 1000
    assert result["attributes"]["category"] == "sdk.options"
    assert result["attributes"]["shouldRecordCanvas"] is True
    assert result["attributes"]["sessionSampleRate"] == 0.1
    assert result["attributes"]["errorSampleRate"] == 1.0
    assert result["attributes"]["useCompressionOption"] is False
    assert result["attributes"]["blockAllMedia"] is True
    assert result["attributes"]["maskAllText"] is False
    assert result["attributes"]["maskAllInputs"] is True
    assert result["attributes"]["useCompression"] is False
    assert result["attributes"]["networkDetailHasUrls"] is True
    assert result["attributes"]["networkCaptureBodies"] is False
    assert result["attributes"]["networkRequestHasHeaders"] is True
    assert result["attributes"]["networkResponseHasHeaders"] is False
    assert "event_hash" in result and len(result["event_hash"]) == 16


def test_as_trace_item_context_options_missing_payload() -> None:
    event = {
        "type": 5,
        "timestamp": 1753710752516,
        "data": {
            "tag": "options",
            "payload": {},
        },
    }

    result = as_trace_item_context(which(event), event)
    assert result is not None
    assert result["timestamp"] == 1753710752.516  # timestamp is divided by 1000
    assert result["attributes"]["category"] == "sdk.options"
    assert "event_hash" in result and len(result["event_hash"]) == 16


def test_as_trace_item_context_memory() -> None:
    event = {
        "type": 5,
        "timestamp": 1753467523.594,
        "data": {
            "tag": "performanceSpan",
            "payload": {
                "op": "memory",
                "description": "memory",
                "startTimestamp": 1753467523.594,
                "endTimestamp": 1753467523.594,
                "data": {
                    "memory": {
                        "jsHeapSizeLimit": 4294705152,
                        "totalJSHeapSize": 111507602,
                        "usedJSHeapSize": 69487254,
                    }
                },
            },
        },
    }

    result = as_trace_item_context(which(event), event)
    assert result is not None
    assert result["timestamp"] == 1753467523.594
    assert result["attributes"]["category"] == "memory"
    assert result["attributes"]["jsHeapSizeLimit"] == 4294705152
    assert result["attributes"]["totalJSHeapSize"] == 111507602
    assert result["attributes"]["usedJSHeapSize"] == 69487254
    assert result["attributes"]["endTimestamp"] == 1753467523.594
    assert "event_hash" in result and len(result["event_hash"]) == 16


def test_as_trace_item_context_returns_none_for_unsupported_events() -> None:
    event: dict[str, Any] = {"data": {"payload": {}}}
    assert as_trace_item_context(EventType.CONSOLE, event) is None
    assert as_trace_item_context(EventType.UI_BLUR, event) is None
    assert as_trace_item_context(EventType.UI_FOCUS, event) is None
    assert as_trace_item_context(EventType.UNKNOWN, event) is None
    assert as_trace_item_context(EventType.CANVAS, event) is None
    assert as_trace_item_context(EventType.FEEDBACK, event) is None
    assert as_trace_item_context(EventType.MULTI_CLICK, event) is None


def test_as_trace_item() -> None:
    context: EventContext = {
        "organization_id": 123,
        "project_id": 456,
        "received": 1674298825.0,
        "retention_days": 30,
        "trace_id": "trace-123",
        "replay_id": "replay-456",
        "segment_id": 1,
        "user_id": "user-123",
        "user_email": "test@example.com",
        "user_name": "Test User",
        "user_ip": "192.168.1.1",
        "user_geo_city": "San Francisco",
        "user_geo_country_code": "US",
        "user_geo_region": "California",
        "user_geo_subdivision": "CA",
    }

    event = {
        "data": {
            "payload": {
                "timestamp": 1674298825.403,
                "description": "https://sentry.io/",
                "data": {"from": "/old-page", "to": "/new-page"},
            }
        }
    }

    result = as_trace_item(context, EventType.NAVIGATION, event)
    assert result is not None
    assert result.organization_id == 123
    assert result.project_id == 456
    assert result.trace_id == "trace-123"
    assert result.retention_days == 30
    assert result.received.ToSeconds() == 1674298825
    assert result.timestamp.ToMilliseconds() == int(1674298825.403 * 1000)
    assert result.attributes["category"].string_value == "navigation"
    assert result.attributes["from"].string_value == "/old-page"
    assert result.attributes["to"].string_value == "/new-page"
    assert result.attributes["replay_id"].string_value == "replay-456"  # Should be added

    # User attributes
    assert result.attributes["user_id"].string_value == "user-123"
    assert result.attributes["user_email"].string_value == "test@example.com"
    assert result.attributes["user_name"].string_value == "Test User"
    assert result.attributes["user_ip"].string_value == "192.168.1.1"
    assert result.attributes["user_geo_city"].string_value == "San Francisco"
    assert result.attributes["user_geo_country_code"].string_value == "US"
    assert result.attributes["user_geo_region"].string_value == "California"
    assert result.attributes["user_geo_subdivision"].string_value == "CA"


def test_as_trace_item_with_no_trace_id() -> None:
    context: EventContext = {
        "organization_id": 123,
        "project_id": 456,
        "received": 1674298825.0,
        "retention_days": 30,
        "trace_id": None,
        "replay_id": "replay-456",
        "segment_id": 1,
        "user_id": None,
        "user_email": None,
        "user_name": None,
        "user_ip": None,
        "user_geo_city": None,
        "user_geo_country_code": None,
        "user_geo_region": None,
        "user_geo_subdivision": None,
    }

    event = {
        "data": {
            "payload": {
                "timestamp": 1674298825.403,
                "description": "https://sentry.io/",
                "data": {"from": "/old-page", "to": "/new-page"},
            }
        }
    }

    result = as_trace_item(context, EventType.NAVIGATION, event)
    assert result is not None
    assert result.trace_id == "replay-456"  # Should fall back to replay_id


def test_as_trace_item_returns_none_for_unsupported_event() -> None:
    context: EventContext = {
        "organization_id": 123,
        "project_id": 456,
        "received": 1674298825.0,
        "retention_days": 30,
        "trace_id": "trace-123",
        "replay_id": "replay-456",
        "segment_id": 1,
        "user_id": None,
        "user_email": None,
        "user_name": None,
        "user_ip": None,
        "user_geo_city": None,
        "user_geo_country_code": None,
        "user_geo_region": None,
        "user_geo_subdivision": None,
    }

    event: dict[str, Any] = {"data": {"payload": {}}}
    assert as_trace_item(context, EventType.CONSOLE, event) is None


@mock.patch("sentry.options.get")
def test_parse_events(options_get: mock.MagicMock) -> None:
    """Test "parse_events" function."""
    options_get.return_value = 1

    parsed, trace_items = parse_events(
        {
            "organization_id": 1,
            "project_id": 1,
            "received": 1,
            "replay_id": "1",
            "retention_days": 1,
            "segment_id": 1,
            "trace_id": None,
            "user_id": None,
            "user_email": None,
            "user_name": None,
            "user_ip": None,
            "user_geo_city": None,
            "user_geo_country_code": None,
            "user_geo_region": None,
            "user_geo_subdivision": None,
        },
        [
            {
                "type": 5,
                "timestamp": 1674291701348,
                "data": {
                    "tag": "breadcrumb",
                    "payload": {
                        "timestamp": 1.1,
                        "type": "default",
                        "category": "ui.slowClickDetected",
                        "message": "div.container > div#root > div > ul > div",
                        "data": {
                            "clickcount": 5,
                            "endReason": "timeout",
                            "timeafterclickms": 0,
                            "nodeId": 59,
                            "url": "https://www.sentry.io",
                            "node": {
                                "id": 59,
                                "tagName": "a",
                                "attributes": {
                                    "id": "id",
                                    "class": "class1 class2",
                                    "role": "button",
                                    "aria-label": "test",
                                    "alt": "1",
                                    "data-testid": "2",
                                    "title": "3",
                                    "data-sentry-component": "SignUpForm",
                                },
                                "textContent": "text",
                            },
                        },
                    },
                },
            }
        ],
    )

    assert len(trace_items) == 1
    assert len(parsed.click_events) == 1


@mock.patch("sentry.options.get")
def test_parse_events_disabled(options_get: mock.MagicMock) -> None:
    """Test "parse_events" function."""
    options_get.return_value = 0

    parsed, trace_items = parse_events(
        {
            "organization_id": 1,
            "project_id": 1,
            "received": 1,
            "replay_id": "1",
            "retention_days": 1,
            "segment_id": 1,
            "trace_id": None,
            "user_id": None,
            "user_email": None,
            "user_name": None,
            "user_ip": None,
            "user_geo_city": None,
            "user_geo_country_code": None,
            "user_geo_region": None,
            "user_geo_subdivision": None,
        },
        [
            {
                "type": 5,
                "timestamp": 1674291701348,
                "data": {
                    "tag": "breadcrumb",
                    "payload": {
                        "timestamp": 1.1,
                        "type": "default",
                        "category": "ui.slowClickDetected",
                        "message": "div.container > div#root > div > ul > div",
                        "data": {
                            "clickcount": 5,
                            "endReason": "timeout",
                            "timeafterclickms": 0,
                            "nodeId": 59,
                            "url": "https://www.sentry.io",
                            "node": {
                                "id": 59,
                                "tagName": "a",
                                "attributes": {
                                    "id": "id",
                                    "class": "class1 class2",
                                    "role": "button",
                                    "aria-label": "test",
                                    "alt": "1",
                                    "data-testid": "2",
                                    "title": "3",
                                    "data-sentry-component": "SignUpForm",
                                },
                                "textContent": "text",
                            },
                        },
                    },
                },
            }
        ],
    )

    assert len(trace_items) == 0
    assert len(parsed.click_events) == 1


def test_set_if() -> None:
    assert set_if(["a", "b"], {"a": 1}, str) == {"a": "1"}
    assert set_if(["a", "b"], {"b": 2}, str) == {"b": "2"}
    assert set_if(["a", "b"], {}, str) == {}

    with pytest.raises(ValueError):
        assert set_if(["a", "b"], {"b": "hello"}, int)
