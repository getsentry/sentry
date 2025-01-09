from __future__ import annotations

import uuid
from typing import Any
from unittest import mock
from unittest.mock import Mock

import pytest

from sentry.models.project import Project
from sentry.replays.testutils import mock_replay_event
from sentry.replays.usecases.ingest.dom_index import (
    _get_testid,
    _parse_classes,
    encode_as_uuid,
    get_user_actions,
    log_canvas_size,
    parse_replay_actions,
)
from sentry.testutils.helpers import override_options
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import json


@pytest.fixture(autouse=True)
def patch_rage_click_issue_with_replay_event():
    with mock.patch(
        "sentry.replays.usecases.ingest.dom_index.report_rage_click_issue_with_replay_event"
    ) as m:
        yield m


@pytest.fixture(autouse=True)
def mock_project() -> Project:
    """Has id=1. Use for unit tests so we can skip @django_db"""
    proj = Mock(spec=Project)
    proj.id = 1
    return proj


def test_get_user_actions(mock_project):
    """Test "get_user_actions" function."""
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

    user_actions = get_user_actions(mock_project, uuid.uuid4().hex, events, None)
    assert len(user_actions) == 1
    assert user_actions[0]["node_id"] == 1
    assert user_actions[0]["tag"] == "div"
    assert user_actions[0]["id"] == "hello"
    assert user_actions[0]["class"] == ["hello", "world"]
    assert user_actions[0]["text"] == "Hello, world!"
    assert user_actions[0]["role"] == "button"
    assert user_actions[0]["alt"] == "1"
    assert user_actions[0]["testid"] == "2"
    assert user_actions[0]["aria_label"] == "test"
    assert user_actions[0]["title"] == "3"
    assert user_actions[0]["component_name"] == "SignUpForm"
    assert user_actions[0]["is_dead"] == 0
    assert user_actions[0]["is_rage"] == 0
    assert user_actions[0]["timestamp"] == 1674298825
    assert len(user_actions[0]["event_hash"]) == 36


def test_get_user_actions_str_payload(mock_project):
    """Test "get_user_actions" function."""
    events = [
        {
            "type": 5,
            "timestamp": 1674298825,
            "data": {
                "tag": "breadcrumb",
                "payload": "hello world",
            },
        }
    ]

    user_actions = get_user_actions(mock_project, uuid.uuid4().hex, events, None)
    assert len(user_actions) == 0


def test_get_user_actions_missing_node(mock_project):
    """Test "get_user_actions" function."""
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
                },
            },
        }
    ]

    user_actions = get_user_actions(mock_project, uuid.uuid4().hex, events, None)
    assert len(user_actions) == 0


def test_get_user_actions_performance_spans(mock_project):
    """Test that "get_user_actions" doesn't error when collecting rsrc metrics, on various formats of performanceSpan"""
    # payloads are not realistic examples - only include the fields necessary for testing
    # TODO: does not test if metrics.distribution() is called downstream, with correct param types.
    events = [
        {
            "type": 5,
            "timestamp": 1674298825,
            "data": {
                "tag": "performanceSpan",
                "payload": {
                    "op": "resource.fetch",
                    "data": "someString",
                },
            },
        },
        {
            "type": 5,
            "timestamp": 1674298826,
            "data": {
                "tag": "performanceSpan",
                "payload": {
                    "op": "resource.fetch",
                    "data": {
                        "requestBodySize": 40,
                        "request": {"body": "Hello" * 8},
                        "responseBodySize": 34,
                        "response": {"body": "G" * 34},
                    },
                },
            },
        },
        {
            "type": 5,
            "timestamp": 1674298827,
            "data": {
                "tag": "performanceSpan",
                "payload": {
                    "op": "resource.fetch",
                    "data": {
                        "request": {"body": "Hello", "size": 5},
                        "response": {},  # intentionally empty,
                    },
                },
            },
        },
        {
            "type": 5,
            "timestamp": 1674298828,
            "data": {
                "tag": "performanceSpan",
                "payload": {
                    "op": "resource.fetch",
                    "data": {
                        "request": "some string",
                        "response": 1234,
                    },
                },
            },
        },
        {
            "type": 5,
            "timestamp": 1674298829,
            "data": {
                "tag": "performanceSpan",
                "payload": {
                    "op": "resource.fetch",
                    "data": {},
                },
            },
        },
    ]
    get_user_actions(mock_project, uuid.uuid4().hex, events, None)


def test_parse_replay_actions(mock_project):
    events = [
        {
            "type": 5,
            "timestamp": 1674291701348,
            "data": {
                "tag": "breadcrumb",
                "payload": {
                    "timestamp": 1.1,
                    "type": "default",
                    "category": "ui.click",
                    "message": "div.container > div#root > div > ul > div",
                    "data": {
                        "nodeId": 59,
                        "url": "https://www.sentry.io",
                        "node": {
                            "id": 59,
                            "tagName": "div",
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
    ]
    replay_actions = parse_replay_actions(mock_project, "1", 30, events, None)

    assert replay_actions is not None
    assert replay_actions["type"] == "replay_event"
    assert isinstance(replay_actions["start_time"], float)
    assert replay_actions["replay_id"] == "1"
    assert replay_actions["project_id"] == 1
    assert replay_actions["retention_days"] == 30
    assert isinstance(replay_actions["payload"], list)

    payload = json.loads(bytes(replay_actions["payload"]))
    assert payload["type"] == "replay_actions"
    assert payload["replay_id"] == "1"
    assert len(payload["clicks"]) == 1

    action = payload["clicks"][0]
    assert action["node_id"] == 59
    assert action["tag"] == "div"
    assert action["id"] == "id"
    assert action["class"] == ["class1", "class2"]
    assert action["text"] == "text"
    assert action["aria_label"] == "test"
    assert action["role"] == "button"
    assert action["alt"] == "1"
    assert action["testid"] == "2"
    assert action["title"] == "3"
    assert action["component_name"] == "SignUpForm"
    assert action["is_dead"] == 0
    assert action["is_rage"] == 0
    assert action["timestamp"] == 1
    assert len(action["event_hash"]) == 36


@pytest.mark.parametrize("use_experimental_timeout", (False, True))
@django_db_all
def test_parse_replay_dead_click_actions(
    patch_rage_click_issue_with_replay_event, default_project, use_experimental_timeout
):
    experimental_timeout = 5000.0
    default_timeout = 7000.0
    time_after_click_ms = experimental_timeout if use_experimental_timeout else default_timeout

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

    default_project.update_option("sentry:replay_rage_click_issues", True)

    if use_experimental_timeout:
        with override_options(
            {
                "replay.rage-click.experimental-timeout.org-id-list": [1],
                "replay.rage-click.experimental-timeout.milliseconds": experimental_timeout,
            }
        ):
            replay_actions = parse_replay_actions(
                default_project, "1", 30, events, mock_replay_event(), org_id=1
            )
    else:
        replay_actions = parse_replay_actions(default_project, "1", 30, events, mock_replay_event())

    assert patch_rage_click_issue_with_replay_event.call_count == 2
    assert replay_actions is not None
    assert replay_actions["type"] == "replay_event"
    assert isinstance(replay_actions["start_time"], float)
    assert replay_actions["replay_id"] == "1"
    assert replay_actions["project_id"] == default_project.id
    assert replay_actions["retention_days"] == 30
    assert isinstance(replay_actions["payload"], list)

    payload = json.loads(bytes(replay_actions["payload"]))
    assert payload["type"] == "replay_actions"
    assert payload["replay_id"] == "1"
    assert len(payload["clicks"]) == 3

    action = payload["clicks"][0]
    assert action["node_id"] == 59
    assert action["tag"] == "a"
    assert action["id"] == "id"
    assert action["class"] == ["class1", "class2"]
    assert action["text"] == "text"
    assert action["aria_label"] == "test"
    assert action["role"] == "button"
    assert action["alt"] == "1"
    assert action["testid"] == "2"
    assert action["title"] == "3"
    assert action["component_name"] == "SignUpForm"
    assert action["is_dead"] == 1
    assert action["is_rage"] == 0
    assert action["timestamp"] == 1
    assert len(action["event_hash"]) == 36

    # Second slow click had more than 2 clicks which makes it a rage+dead combo.
    action = payload["clicks"][1]
    assert action["is_dead"] == 1
    assert action["is_rage"] == 1

    # Third slow click had more than 2 clicks which makes it a rage+dead combo.
    action = payload["clicks"][2]
    assert action["is_dead"] == 1
    assert action["is_rage"] == 1


@django_db_all
def test_rage_click_issue_creation_no_component_name(
    patch_rage_click_issue_with_replay_event, default_project
):
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
                        "timeafterclickms": 7000.0,
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
                        "timeafterclickms": 7000.0,
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
                        "timeAfterClickMs": 7000.0,
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
                            },
                            "textContent": "text",
                        },
                    },
                },
            },
        },
    ]

    default_project.update_option("sentry:replay_rage_click_issues", True)
    parse_replay_actions(default_project, "1", 30, events, mock_replay_event())

    # test that 2 rage click issues are still created
    assert patch_rage_click_issue_with_replay_event.call_count == 2


@django_db_all
def test_parse_replay_click_actions_not_dead(
    patch_rage_click_issue_with_replay_event, default_project
):
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
                        "timeafterclickms": 5000.0,
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
    ]

    replay_actions = parse_replay_actions(default_project, "1", 30, events, None)
    assert patch_rage_click_issue_with_replay_event.delay.call_count == 0
    assert replay_actions is None


@django_db_all
def test_parse_replay_rage_click_actions(default_project):
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
                        "timeafterclickms": 7000.0,
                        "clickcount": 5,
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
    ]
    replay_actions = parse_replay_actions(default_project, "1", 30, events, None)

    assert replay_actions is not None
    assert replay_actions["type"] == "replay_event"
    assert isinstance(replay_actions["start_time"], float)
    assert replay_actions["replay_id"] == "1"
    assert replay_actions["project_id"] == default_project.id
    assert replay_actions["retention_days"] == 30
    assert isinstance(replay_actions["payload"], list)

    payload = json.loads(bytes(replay_actions["payload"]))
    assert payload["type"] == "replay_actions"
    assert payload["replay_id"] == "1"
    assert len(payload["clicks"]) == 1

    action = payload["clicks"][0]
    assert action["node_id"] == 59
    assert action["tag"] == "a"
    assert action["id"] == "id"
    assert action["class"] == ["class1", "class2"]
    assert action["text"] == "text"
    assert action["aria_label"] == "test"
    assert action["role"] == "button"
    assert action["alt"] == "1"
    assert action["testid"] == "2"
    assert action["title"] == "3"
    assert action["component_name"] == "SignUpForm"
    assert action["is_dead"] == 1
    assert action["is_rage"] == 1
    assert action["timestamp"] == 1
    assert len(action["event_hash"]) == 36


def test_encode_as_uuid():
    a = encode_as_uuid("hello,world!")
    b = encode_as_uuid("hello,world!")
    assert a == b
    assert isinstance(uuid.UUID(a), uuid.UUID)


def test_parse_request_response_latest(mock_project):
    events = [
        {
            "type": 5,
            "timestamp": 1680009712.507,
            "data": {
                "tag": "performanceSpan",
                "payload": {
                    "op": "resource.fetch",
                    "description": "https://api2.amplitude.com/2/httpapi",
                    "startTimestamp": 1680009712.507,
                    "endTimestamp": 1680009712.671,
                    "data": {
                        "url": "https://www.sentry.io",
                        "method": "POST",
                        "statusCode": 200,
                        "request": {
                            "size": 2949,
                            "body": {
                                "api_key": "foobar",
                                "events": "[...]",
                                "options": {"min_id_length": 1},
                            },
                        },
                        "response": {
                            "size": 94,
                            "body": {
                                "code": 200,
                                "server_upload_time": 1680009712652,
                                "payload_size_bytes": 2949,
                                "events_ingested": 5,
                            },
                        },
                    },
                },
            },
        }
    ]
    with mock.patch("sentry.utils.metrics.distribution") as timing:
        parse_replay_actions(mock_project, "1", 30, events, None)
        assert timing.call_args_list == [
            mock.call("replays.usecases.ingest.request_body_size", 2949, unit="byte"),
            mock.call("replays.usecases.ingest.response_body_size", 94, unit="byte"),
        ]


def test_parse_request_response_no_info(mock_project):
    events = [
        {
            "type": 5,
            "timestamp": 1680009712.507,
            "data": {
                "tag": "performanceSpan",
                "payload": {
                    "op": "resource.fetch",
                    "description": "https://api2.amplitude.com/2/httpapi",
                    "startTimestamp": 1680009712.507,
                    "endTimestamp": 1680009712.671,
                    "data": {
                        "url": "https://www.sentry.io",
                        "method": "POST",
                        "statusCode": 200,
                    },
                },
            },
        },
    ]
    parse_replay_actions(mock_project, "1", 30, events, None)
    # just make sure we don't raise


def test_parse_request_response_old_format_request_only(mock_project):
    events = [
        {
            "type": 5,
            "timestamp": 1680009712.507,
            "data": {
                "tag": "performanceSpan",
                "payload": {
                    "op": "resource.fetch",
                    "description": "https://api2.amplitude.com/2/httpapi",
                    "startTimestamp": 1680009712.507,
                    "endTimestamp": 1680009712.671,
                    "data": {
                        "url": "https://www.sentry.io",
                        "method": "POST",
                        "statusCode": 200,
                        "requestBodySize": 1002,
                    },
                },
            },
        },
    ]
    with mock.patch("sentry.utils.metrics.distribution") as timing:
        parse_replay_actions(mock_project, "1", 30, events, None)
        assert timing.call_args_list == [
            mock.call("replays.usecases.ingest.request_body_size", 1002, unit="byte"),
        ]


def test_parse_request_response_old_format_response_only(mock_project):
    events = [
        {
            "type": 5,
            "timestamp": 1680009712.507,
            "data": {
                "tag": "performanceSpan",
                "payload": {
                    "op": "resource.fetch",
                    "description": "https://api2.amplitude.com/2/httpapi",
                    "startTimestamp": 1680009712.507,
                    "endTimestamp": 1680009712.671,
                    "data": {
                        "method": "POST",
                        "statusCode": 200,
                        "responseBodySize": 1002,
                    },
                },
            },
        },
    ]
    with mock.patch("sentry.utils.metrics.distribution") as timing:
        parse_replay_actions(mock_project, "1", 30, events, None)
        assert timing.call_args_list == [
            mock.call("replays.usecases.ingest.response_body_size", 1002, unit="byte"),
        ]


def test_parse_request_response_old_format_request_and_response(mock_project):
    events = [
        {
            "type": 5,
            "timestamp": 1680009712.507,
            "data": {
                "tag": "performanceSpan",
                "payload": {
                    "op": "resource.xhr",
                    "description": "https://api2.amplitude.com/2/httpapi",
                    "startTimestamp": 1680009712.507,
                    "endTimestamp": 1680009712.671,
                    "data": {
                        "method": "POST",
                        "statusCode": 200,
                        "requestBodySize": 1002,
                        "responseBodySize": 8001,
                    },
                },
            },
        },
    ]
    with mock.patch("sentry.utils.metrics.distribution") as timing:
        parse_replay_actions(mock_project, "1", 30, events, None)
        assert timing.call_args_list == [
            mock.call("replays.usecases.ingest.request_body_size", 1002, unit="byte"),
            mock.call("replays.usecases.ingest.response_body_size", 8001, unit="byte"),
        ]


@django_db_all
def test_parse_replay_rage_clicks_with_replay_event(
    patch_rage_click_issue_with_replay_event, default_project
):
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
                        "timeafterclickms": 7000.0,
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
                        "timeafterclickms": 7000.0,
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
                        "timeAfterClickMs": 7000.0,
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

    default_project.update_option("sentry:replay_rage_click_issues", True)
    replay_actions = parse_replay_actions(default_project, "1", 30, events, mock_replay_event())
    assert patch_rage_click_issue_with_replay_event.call_count == 2
    assert replay_actions is not None
    assert replay_actions["type"] == "replay_event"
    assert isinstance(replay_actions["start_time"], float)
    assert replay_actions["replay_id"] == "1"
    assert replay_actions["project_id"] == default_project.id
    assert replay_actions["retention_days"] == 30
    assert isinstance(replay_actions["payload"], list)


def test_log_sdk_options(mock_project):
    events: list[dict[str, Any]] = [
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
    log = events[0]["data"]["payload"].copy()
    log["project_id"] = 1
    log["replay_id"] = "1"

    with (
        mock.patch("sentry.replays.usecases.ingest.dom_index.logger") as logger,
        mock.patch("random.randint") as randint,
    ):
        randint.return_value = 0
        parse_replay_actions(mock_project, "1", 30, events, None)
        assert logger.info.call_args_list == [mock.call("sentry.replays.slow_click", extra=log)]


def test_log_large_dom_mutations(mock_project):
    events: list[dict[str, Any]] = [
        {
            "type": 5,
            "timestamp": 1684218178.308,
            "data": {
                "tag": "breadcrumb",
                "payload": {
                    "timestamp": 1684218178.308,
                    "type": "default",
                    "category": "replay.mutations",
                    "data": {"count": 1738},
                },
            },
        }
    ]

    log = events[0]["data"]["payload"].copy()
    log["project_id"] = 1
    log["replay_id"] = "1"

    with (
        mock.patch("sentry.replays.usecases.ingest.dom_index.logger") as logger,
        mock.patch("random.randint") as randint,
    ):
        randint.return_value = 0
        parse_replay_actions(mock_project, "1", 30, events, None)
        assert logger.info.call_args_list == [mock.call("Large DOM Mutations List:", extra=log)]


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


def test_log_canvas_size():
    event = {
        "type": 3,
        "data": {
            "source": 9,
            "id": 2440,
            "type": 0,
            "commands": [
                {"property": "clearRect", "args": [0, 0, 1342, 60]},
                {
                    "property": "drawImage",
                    "args": [
                        {
                            "rr_type": "ImageBitmap",
                            "args": [
                                {
                                    "rr_type": "Blob",
                                    "data": [{"rr_type": "ArrayBuffer", "base64": "..."}],
                                    "type": "image/png",
                                }
                            ],
                        },
                        0,
                        0,
                    ],
                },
            ],
        },
        "timestamp": 1704225903264,
    }

    # Valid event.
    log_canvas_size(1, 1, "a", [event])

    # Invalid event.
    log_canvas_size(1, 1, "a", [{}])

    # No events.
    log_canvas_size(1, 1, "a", [])


def test_emit_click_negative_node_id(mock_project):
    """Test "get_user_actions" function."""
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

    user_actions = get_user_actions(mock_project, uuid.uuid4().hex, events, None)
    assert len(user_actions) == 0
