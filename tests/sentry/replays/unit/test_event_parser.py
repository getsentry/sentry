from sentry.replays.usecases.ingest.event_parser import _get_testid, _parse_classes, _parse_events
from sentry.utils import json


def test_parse_events_canvas_sizes():
    events = [{"type": 3, "data": {"source": 9, "id": 2440, "type": 0, "commands": [{"a": "b"}]}}]
    result = _parse_events(events, sampled=True)
    assert len(result.canvas_sizes) == 1
    assert result.canvas_sizes[0] == len(json.dumps(events[0]))

    # Not sampled.
    result = _parse_events(events, sampled=False)
    assert len(result.canvas_sizes) == 0


def test_parse_events_mutation_events():
    events = [
        {
            "type": 5,
            "data": {
                "tag": "breadcrumb",
                "payload": {"category": "replay.mutations", "data": {"count": 1738}},
            },
        }
    ]
    result = _parse_events(events, sampled=True)
    assert len(result.mutation_events) == 1
    assert result.mutation_events[0].payload == events[0]["data"]["payload"]  # type: ignore[index]

    # Not sampled.
    result = _parse_events(events, sampled=False)
    assert len(result.mutation_events) == 0


def test_parse_events_options_events():
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
    result = _parse_events(events, sampled=True)
    assert len(result.options_events) == 1
    assert result.options_events[0] == events[0]

    # Not sampled.
    result = _parse_events(events, sampled=False)
    assert len(result.options_events) == 0


def test_parse_events_hydration_errors():
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
    result = _parse_events(events, sampled=False)
    assert len(result.hydration_errors) == 1
    assert result.hydration_errors[0].url == events[0]["data"]["payload"]["data"]["url"]  # type: ignore[index]
    assert result.hydration_errors[0].timestamp == events[0]["data"]["payload"]["timestamp"]  # type: ignore[index]


def test_parse_events_hydration_errors_missing_data_key():
    events = [
        {
            "type": 5,
            "data": {
                "tag": "breadcrumb",
                "payload": {"category": "replay.hydrate-error", "timestamp": 1.0},
            },
        }
    ]
    result = _parse_events(events, sampled=False)
    assert len(result.hydration_errors) == 1
    assert result.hydration_errors[0].url is None
    assert result.hydration_errors[0].timestamp == events[0]["data"]["payload"]["timestamp"]  # type: ignore[index]


# Request response body sizes parsing.


def test_parse_events_payload_sizes_old_format():
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
    result = _parse_events(events, sampled=True)
    assert len(result.request_response_sizes) == 1
    assert result.request_response_sizes[0] == (1002, 8001)


def test_parse_events_payload_sizes_old_format_no_response():
    events = [
        {
            "type": 5,
            "data": {
                "tag": "performanceSpan",
                "payload": {"op": "resource.xhr", "data": {"requestBodySize": 1002}},
            },
        },
    ]
    result = _parse_events(events, sampled=True)
    assert len(result.request_response_sizes) == 1
    assert result.request_response_sizes[0] == (1002, None)


def test_parse_events_payload_sizes_old_format_no_request():
    events = [
        {
            "type": 5,
            "data": {
                "tag": "performanceSpan",
                "payload": {"op": "resource.xhr", "data": {"responseBodySize": 8001}},
            },
        },
    ]
    result = _parse_events(events, sampled=True)
    assert len(result.request_response_sizes) == 1
    assert result.request_response_sizes[0] == (None, 8001)


def test_parse_events_payload_sizes_old_format_nothing():
    events = [
        {
            "type": 5,
            "data": {"tag": "performanceSpan", "payload": {"op": "resource.xhr", "data": {}}},
        },
    ]
    result = _parse_events(events, sampled=True)
    assert len(result.request_response_sizes) == 0


def test_parse_events_payload_sizes_new_format():
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
    result = _parse_events(events, sampled=True)
    assert len(result.request_response_sizes) == 1
    assert result.request_response_sizes[0] == (5, 22)


def test_parse_events_payload_sizes_new_format_no_response():
    events = [
        {
            "type": 5,
            "data": {
                "tag": "performanceSpan",
                "payload": {"op": "resource.fetch", "data": {"request": {"size": 5}}},
            },
        }
    ]
    result = _parse_events(events, sampled=True)
    assert len(result.request_response_sizes) == 1
    assert result.request_response_sizes[0] == (5, None)


def test_parse_events_payload_sizes_new_format_no_request():
    events = [
        {
            "type": 5,
            "data": {
                "tag": "performanceSpan",
                "payload": {"op": "resource.fetch", "data": {"response": {"size": 5}}},
            },
        }
    ]
    result = _parse_events(events, sampled=True)
    assert len(result.request_response_sizes) == 1
    assert result.request_response_sizes[0] == (None, 5)


def test_parse_events_payload_sizes_new_format_nothing():
    events = [
        {
            "type": 5,
            "data": {"tag": "performanceSpan", "payload": {"op": "resource.fetch"}},
        },
    ]
    result = _parse_events(events, sampled=True)
    assert len(result.request_response_sizes) == 0


def test_parse_events_payload_sizes_invalid_op():
    events = [
        {
            "type": 5,
            "data": {
                "tag": "performanceSpan",
                "payload": {"op": "a", "data": {"response": {"size": 5}}},
            },
        }
    ]
    result = _parse_events(events, sampled=True)
    assert len(result.request_response_sizes) == 0


# Click parsing.


def test_parse_events_click_events():
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

    user_actions = _parse_events(events, sampled=False)
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


def test_parse_events_click_event_str_payload():
    events = [{"type": 5, "data": {"tag": "breadcrumb", "payload": "hello world"}}]
    result = _parse_events(events, sampled=False)
    assert len(result.click_events) == 0


def test_parse_events_click_event_missing_node():
    events = [
        {
            "type": 5,
            "data": {
                "tag": "breadcrumb",
                "payload": {"category": "ui.click", "message": "div#hello.hello.world"},
            },
        }
    ]

    result = _parse_events(events, sampled=False)
    assert len(result.click_events) == 0


def test_parse_events_click_event_dead_rage():
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

    result = _parse_events(events, sampled=False)
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

    result = _parse_events(events, sampled=False)
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
