import pytest

from sentry.replays.usecases.ingest.event_parser import (
    EventType,
    _get_testid,
    _parse_classes,
    as_trace_item,
    as_trace_item_context,
    iter_trace_items,
    parse_highlighted_events,
    which,
)
from sentry.utils import json


def test_parse_highlighted_events_canvas_sizes():
    events = [{"type": 3, "data": {"source": 9, "id": 2440, "type": 0, "commands": [{"a": "b"}]}}]
    result = parse_highlighted_events(events, sampled=True)
    assert len(result.canvas_sizes) == 1
    assert result.canvas_sizes[0] == len(json.dumps(events[0]))

    # Not sampled.
    result = parse_highlighted_events(events, sampled=False)
    assert len(result.canvas_sizes) == 0


def test_parse_highlighted_events_mutation_events():
    events = [
        {
            "type": 5,
            "data": {
                "tag": "breadcrumb",
                "payload": {"category": "replay.mutations", "data": {"count": 1738}},
            },
        }
    ]
    result = parse_highlighted_events(events, sampled=True)
    assert len(result.mutation_events) == 1
    assert result.mutation_events[0].payload == events[0]["data"]["payload"]  # type: ignore[index]

    # Not sampled.
    result = parse_highlighted_events(events, sampled=False)
    assert len(result.mutation_events) == 0


def test_parse_highlighted_events_options_events():
    events = [
        {
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
    ]
    result = parse_highlighted_events(events, sampled=True)
    assert len(result.options_events) == 1
    assert result.options_events[0] == events[0]

    # Not sampled.
    result = parse_highlighted_events(events, sampled=False)
    assert len(result.options_events) == 0


def test_parse_highlighted_events_hydration_errors():
    events = [
        {
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
    ]
    result = parse_highlighted_events(events, sampled=False)
    assert len(result.hydration_errors) == 1
    assert result.hydration_errors[0].url == events[0]["data"]["payload"]["data"]["url"]  # type: ignore[index]
    assert result.hydration_errors[0].timestamp == events[0]["data"]["payload"]["timestamp"]  # type: ignore[index]


def test_parse_highlighted_events_hydration_errors_missing_data_key():
    events = [
        {
            "type": 5,
            "data": {
                "tag": "breadcrumb",
                "payload": {"category": "replay.hydrate-error", "timestamp": 1.0},
            },
        }
    ]
    result = parse_highlighted_events(events, sampled=False)
    assert len(result.hydration_errors) == 1
    assert result.hydration_errors[0].url is None
    assert result.hydration_errors[0].timestamp == events[0]["data"]["payload"]["timestamp"]  # type: ignore[index]


# Request response body sizes parsing.


def test_parse_highlighted_events_payload_sizes_old_format():
    events = [
        {
            "type": 5,
            "data": {
                "tag": "performanceSpan",
                "payload": {
                    "op": "resource.xhr",
                    "data": {"requestBodySize": 1002, "responseBodySize": 8001},
                },
            },
        },
    ]
    result = parse_highlighted_events(events, sampled=True)
    assert len(result.request_response_sizes) == 1
    assert result.request_response_sizes[0] == (1002, 8001)


def test_parse_highlighted_events_payload_sizes_old_format_no_response():
    events = [
        {
            "type": 5,
            "data": {
                "tag": "performanceSpan",
                "payload": {"op": "resource.xhr", "data": {"requestBodySize": 1002}},
            },
        },
    ]
    result = parse_highlighted_events(events, sampled=True)
    assert len(result.request_response_sizes) == 1
    assert result.request_response_sizes[0] == (1002, None)


def test_parse_highlighted_events_payload_sizes_old_format_no_request():
    events = [
        {
            "type": 5,
            "data": {
                "tag": "performanceSpan",
                "payload": {"op": "resource.xhr", "data": {"responseBodySize": 8001}},
            },
        },
    ]
    result = parse_highlighted_events(events, sampled=True)
    assert len(result.request_response_sizes) == 1
    assert result.request_response_sizes[0] == (None, 8001)


def test_parse_highlighted_events_payload_sizes_old_format_nothing():
    events = [
        {
            "type": 5,
            "data": {"tag": "performanceSpan", "payload": {"op": "resource.xhr", "data": {}}},
        },
    ]
    result = parse_highlighted_events(events, sampled=True)
    assert len(result.request_response_sizes) == 0


def test_parse_highlighted_events_payload_sizes_new_format():
    events = [
        {
            "type": 5,
            "data": {
                "tag": "performanceSpan",
                "payload": {
                    "op": "resource.fetch",
                    "data": {"request": {"size": 5}, "response": {"size": 22}},
                },
            },
        }
    ]
    result = parse_highlighted_events(events, sampled=True)
    assert len(result.request_response_sizes) == 1
    assert result.request_response_sizes[0] == (5, 22)


def test_parse_highlighted_events_payload_sizes_new_format_no_response():
    events = [
        {
            "type": 5,
            "data": {
                "tag": "performanceSpan",
                "payload": {"op": "resource.fetch", "data": {"request": {"size": 5}}},
            },
        }
    ]
    result = parse_highlighted_events(events, sampled=True)
    assert len(result.request_response_sizes) == 1
    assert result.request_response_sizes[0] == (5, None)


def test_parse_highlighted_events_payload_sizes_new_format_no_request():
    events = [
        {
            "type": 5,
            "data": {
                "tag": "performanceSpan",
                "payload": {"op": "resource.fetch", "data": {"response": {"size": 5}}},
            },
        }
    ]
    result = parse_highlighted_events(events, sampled=True)
    assert len(result.request_response_sizes) == 1
    assert result.request_response_sizes[0] == (None, 5)


def test_parse_highlighted_events_payload_sizes_new_format_nothing():
    events = [
        {
            "type": 5,
            "data": {"tag": "performanceSpan", "payload": {"op": "resource.fetch"}},
        },
    ]
    result = parse_highlighted_events(events, sampled=True)
    assert len(result.request_response_sizes) == 0


def test_parse_highlighted_events_payload_sizes_invalid_op():
    events = [
        {
            "type": 5,
            "data": {
                "tag": "performanceSpan",
                "payload": {"op": "a", "data": {"response": {"size": 5}}},
            },
        }
    ]
    result = parse_highlighted_events(events, sampled=True)
    assert len(result.request_response_sizes) == 0


# Click parsing.


def test_parse_highlighted_events_click_events():
    events = [
        {
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
    ]

    user_actions = parse_highlighted_events(events, sampled=False)
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


def test_parse_highlighted_events_click_event_str_payload():
    events = [{"type": 5, "data": {"tag": "breadcrumb", "payload": "hello world"}}]
    result = parse_highlighted_events(events, sampled=False)
    assert len(result.click_events) == 0


def test_parse_highlighted_events_click_event_missing_node():
    events = [
        {
            "type": 5,
            "data": {
                "tag": "breadcrumb",
                "payload": {"category": "ui.click", "message": "div#hello.hello.world"},
            },
        }
    ]

    result = parse_highlighted_events(events, sampled=False)
    assert len(result.click_events) == 0


def test_parse_highlighted_events_click_event_dead_rage():
    time_after_click_ms = 7000.0
    events = [
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
        },
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
        },
        # New style slowClickDetected payload.
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
        },
    ]

    result = parse_highlighted_events(events, sampled=False)
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


def test_emit_click_negative_node_id():
    events = [
        {
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
    ]

    result = parse_highlighted_events(events, sampled=False)
    assert len(result.click_events) == 0


# Misc helper tests


def test_get_testid():
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


def test_parse_classes():
    assert _parse_classes("") == []
    assert _parse_classes("   ") == []
    assert _parse_classes("  a b ") == ["a", "b"]
    assert _parse_classes("a  ") == ["a"]
    assert _parse_classes("  a") == ["a"]


def test_which():
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
        "data": {"tag": "breadcrumb", "payload": {"category": "navigation"}},
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
        "data": {
            "tag": "performanceSpan",
            "payload": {"op": "web-vital", "description": "first-contentful-paint"},
        },
    }
    assert which(event) == EventType.FCP

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
def test_parse_highlighted_events_fault_tolerance(event):
    # If the test raises an exception we fail. All of these events are invalid.
    parse_highlighted_events([event], True)


# Tests for trace item functions


def test_as_trace_item_context_click_event():
    event = {
        "data": {
            "payload": {
                "timestamp": 1674298825.403,
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
            }
        }
    }

    result = as_trace_item_context(EventType.CLICK, event)
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


def test_as_trace_item_context_dead_click_event():
    event = {
        "data": {
            "payload": {
                "timestamp": 1674298825.403,
                "message": "button.slow",
                "data": {
                    "node": {
                        "id": 456,
                        "tagName": "button",
                        "textContent": "Slow button",
                        "attributes": {},
                    }
                },
            }
        }
    }

    result = as_trace_item_context(EventType.DEAD_CLICK, event)
    assert result is not None
    assert result["attributes"]["is_dead"] is True
    assert result["attributes"]["is_rage"] is False


def test_as_trace_item_context_rage_click_event():
    event = {
        "data": {
            "payload": {
                "timestamp": 1674298825.403,
                "message": "button.rage",
                "data": {
                    "node": {
                        "id": 789,
                        "tagName": "button",
                        "textContent": "Rage button",
                        "attributes": {},
                    }
                },
            }
        }
    }

    result = as_trace_item_context(EventType.RAGE_CLICK, event)
    assert result is not None
    assert result["attributes"]["is_dead"] is True
    assert result["attributes"]["is_rage"] is True


def test_as_trace_item_context_navigation_event():
    event = {
        "data": {
            "payload": {"timestamp": 1674298825.0, "data": {"from": "/old-page", "to": "/new-page"}}
        }
    }

    result = as_trace_item_context(EventType.NAVIGATION, event)
    assert result is not None
    assert result["timestamp"] == 1674298825.0
    assert result["attributes"]["category"] == "navigation"
    assert result["attributes"]["from"] == "/old-page"
    assert result["attributes"]["to"] == "/new-page"


def test_as_trace_item_context_navigation_event_missing_optional_fields():
    event = {"data": {"payload": {"timestamp": 1674298825.0, "data": {}}}}

    result = as_trace_item_context(EventType.NAVIGATION, event)
    assert result is not None
    assert result["attributes"]["category"] == "navigation"
    assert "from" not in result["attributes"]
    assert "to" not in result["attributes"]


def test_as_trace_item_context_resource_fetch_event():
    event = {
        "data": {
            "payload": {
                "timestamp": 1674298825.0,
                "data": {"requestBodySize": 1024, "responseBodySize": 2048},
            }
        }
    }

    result = as_trace_item_context(EventType.RESOURCE_FETCH, event)
    assert result is not None
    assert result["timestamp"] == 1674298825.0
    assert result["attributes"]["category"] == "resource.fetch"
    assert result["attributes"]["request_size"] == 1024
    assert result["attributes"]["response_size"] == 2048


def test_as_trace_item_context_resource_xhr_event():
    event = {
        "data": {
            "payload": {
                "timestamp": 1674298825.0,
                "data": {"request": {"size": 512}, "response": {"size": 1024}},
            }
        }
    }

    result = as_trace_item_context(EventType.RESOURCE_XHR, event)
    assert result is not None
    assert result["attributes"]["category"] == "resource.xhr"
    assert result["attributes"]["request_size"] == 512
    assert result["attributes"]["response_size"] == 1024


def test_as_trace_item_context_resource_no_sizes():
    event = {"data": {"payload": {"timestamp": 1674298825.0, "data": {}}}}

    result = as_trace_item_context(EventType.RESOURCE_FETCH, event)
    assert result is not None
    assert result["attributes"]["category"] == "resource.fetch"
    assert "request_size" not in result["attributes"]
    assert "response_size" not in result["attributes"]


def test_as_trace_item_context_lcp_event():
    event = {
        "data": {
            "payload": {
                "timestamp": 1674298825.0,
                "data": {"rating": "good", "size": 1024, "value": 1500},
            }
        }
    }

    result = as_trace_item_context(EventType.LCP, event)
    assert result is not None
    assert result["timestamp"] == 1674298825.0
    assert result["attributes"]["category"] == "web-vital.lcp"
    assert result["attributes"]["rating"] == "good"
    assert result["attributes"]["size"] == 1024
    assert result["attributes"]["value"] == 1500


def test_as_trace_item_context_fcp_event():
    event = {
        "data": {
            "payload": {
                "timestamp": 1674298825.0,
                "data": {"rating": "needs-improvement", "size": 512, "value": 2000},
            }
        }
    }

    result = as_trace_item_context(EventType.FCP, event)
    assert result is not None
    assert result["attributes"]["category"] == "web-vital.fcp"
    assert result["attributes"]["rating"] == "needs-improvement"
    assert result["attributes"]["size"] == 512
    assert result["attributes"]["value"] == 2000


def test_as_trace_item_context_hydration_error():
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


def test_as_trace_item_context_mutations():
    event = {"timestamp": 1674298825000, "data": {"payload": {"data": {"count": 42}}}}

    result = as_trace_item_context(EventType.MUTATIONS, event)
    assert result is not None
    assert result["timestamp"] == 1674298825000
    assert result["attributes"]["category"] == "replay.mutations"
    assert result["attributes"]["count"] == 42


def test_as_trace_item_context_options():
    event = {
        "timestamp": 1674298825507,
        "data": {
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
            }
        },
    }

    result = as_trace_item_context(EventType.OPTIONS, event)
    assert result is not None
    assert result["timestamp"] == 1674298825.507  # timestamp is divided by 1000
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


def test_as_trace_item_context_memory():
    event = {
        "data": {
            "payload": {
                "startTimestamp": 1674298825.0,
                "endTimestamp": 1674298826.5,
                "data": {
                    "jsHeapSizeLimit": 4294705152,
                    "totalJSHeapSize": 50331648,
                    "usedJSHeapSize": 30000000,
                },
            }
        }
    }

    result = as_trace_item_context(EventType.MEMORY, event)
    assert result is not None
    assert result["timestamp"] == 1674298825.0
    assert result["attributes"]["category"] == "memory"
    assert result["attributes"]["jsHeapSizeLimit"] == 4294705152
    assert result["attributes"]["totalJSHeapSize"] == 50331648
    assert result["attributes"]["usedJSHeapSize"] == 30000000
    assert result["attributes"]["endTimestamp"] == 1674298826.5


def test_as_trace_item_context_returns_none_for_unsupported_events():
    event = {"data": {"payload": {}}}
    assert as_trace_item_context(EventType.CONSOLE, event) is None
    assert as_trace_item_context(EventType.UI_BLUR, event) is None
    assert as_trace_item_context(EventType.UI_FOCUS, event) is None
    assert as_trace_item_context(EventType.UNKNOWN, event) is None
    assert as_trace_item_context(EventType.CANVAS, event) is None
    assert as_trace_item_context(EventType.FEEDBACK, event) is None


def test_as_trace_item():
    context = {
        "organization_id": 123,
        "project_id": 456,
        "received": 1674298825.0,
        "retention_days": 30,
        "trace_id": "trace-123",
        "replay_id": "replay-456",
        "segment_id": 1,
    }

    event = {
        "data": {
            "payload": {
                "timestamp": 1674298825.403,
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
    assert result.received == 1674298825.0
    assert result.timestamp.ToMilliseconds() == int(1674298825.403 * 1000)
    assert result.attributes["category"] == "navigation"
    assert result.attributes["from"] == "/old-page"
    assert result.attributes["to"] == "/new-page"
    assert result.attributes["replay_id"] == "replay-456"  # Should be added


def test_as_trace_item_with_no_trace_id():
    context = {
        "organization_id": 123,
        "project_id": 456,
        "received": 1674298825.0,
        "retention_days": 30,
        "trace_id": None,
        "replay_id": "replay-456",
        "segment_id": 1,
    }

    event = {
        "data": {
            "payload": {
                "timestamp": 1674298825.403,
                "data": {"from": "/old-page", "to": "/new-page"},
            }
        }
    }

    result = as_trace_item(context, EventType.NAVIGATION, event)
    assert result is not None
    assert result.trace_id == "replay-456"  # Should fall back to replay_id


def test_as_trace_item_returns_none_for_unsupported_event():
    context = {
        "organization_id": 123,
        "project_id": 456,
        "received": 1674298825.0,
        "retention_days": 30,
        "trace_id": "trace-123",
        "replay_id": "replay-456",
        "segment_id": 1,
    }

    event = {"data": {"payload": {}}}
    assert as_trace_item(context, EventType.CONSOLE, event) is None


def test_iter_trace_items():
    context = {
        "organization_id": 123,
        "project_id": 456,
        "received": 1674298825.0,
        "retention_days": 30,
        "trace_id": "trace-123",
        "replay_id": "replay-456",
        "segment_id": 1,
    }

    events = [
        # Valid navigation event
        {
            "type": 5,
            "data": {
                "tag": "breadcrumb",
                "payload": {
                    "category": "navigation",
                    "timestamp": 1674298825.0,
                    "data": {"from": "/old-page", "to": "/new-page"},
                },
            },
        },
        # Valid click event
        {
            "type": 5,
            "data": {
                "tag": "breadcrumb",
                "payload": {
                    "category": "ui.click",
                    "timestamp": 1674298826.0,
                    "message": "button",
                    "data": {
                        "node": {
                            "id": 123,
                            "tagName": "button",
                            "textContent": "Click me",
                            "attributes": {},
                        }
                    },
                },
            },
        },
        # Unsupported event (console)
        {
            "type": 5,
            "data": {
                "tag": "breadcrumb",
                "payload": {"category": "console", "timestamp": 1674298827.0},
            },
        },
        # Invalid event that will raise exception
        {
            "type": 5,
            "data": {
                "tag": "breadcrumb",
                "payload": {
                    "category": "ui.click",
                    "timestamp": 1674298828.0,
                    "message": "invalid",
                    # Missing required node data
                },
            },
        },
    ]

    # Should get 2 trace items (navigation and click), console is filtered out, invalid event is skipped
    trace_items = list(iter_trace_items(context, events))
    assert len(trace_items) == 2
    assert trace_items[0].organization_id == 123
    assert trace_items[0].attributes["category"] == "navigation"
    assert trace_items[1].attributes["category"] == "ui.click"


def test_iter_trace_items_handles_exceptions():
    context = {
        "organization_id": 123,
        "project_id": 456,
        "received": 1674298825.0,
        "retention_days": 30,
        "trace_id": "trace-123",
        "replay_id": "replay-456",
        "segment_id": 1,
    }

    # Event that will cause KeyError in as_trace_item
    events = [
        {
            "type": 5,
            "data": {
                "tag": "breadcrumb",
                "payload": {
                    "category": "ui.click",
                    # Missing required fields that will cause KeyError
                },
            },
        }
    ]

    # Should not raise exception, should just skip the invalid event
    trace_items = list(iter_trace_items(context, events))
    assert len(trace_items) == 0


def test_iter_trace_items_empty_list():
    context = {
        "organization_id": 123,
        "project_id": 456,
        "received": 1674298825.0,
        "retention_days": 30,
        "trace_id": "trace-123",
        "replay_id": "replay-456",
        "segment_id": 1,
    }

    trace_items = list(iter_trace_items(context, []))
    assert len(trace_items) == 0
