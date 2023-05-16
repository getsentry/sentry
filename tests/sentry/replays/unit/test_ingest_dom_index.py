import uuid
from unittest import mock

from sentry.replays.usecases.ingest.dom_index import (
    _get_testid,
    encode_as_uuid,
    get_user_actions,
    parse_replay_actions,
)
from sentry.utils import json


def test_get_user_actions():
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
                            },
                            "textContent": "Hello, world!",
                        },
                    },
                },
            },
        }
    ]

    user_actions = get_user_actions(1, uuid.uuid4().hex, events)
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
    assert user_actions[0]["timestamp"] == 1674298825
    assert len(user_actions[0]["event_hash"]) == 36


def test_get_user_actions_missing_node():
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

    user_actions = get_user_actions(1, uuid.uuid4().hex, events)
    assert len(user_actions) == 0


def test_parse_replay_actions():
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
                            },
                            "textContent": "text",
                        },
                    },
                },
            },
        }
    ]
    replay_actions = parse_replay_actions(1, "1", 30, events)

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
    assert action["timestamp"] == 1
    assert len(action["event_hash"]) == 36


def test_encode_as_uuid():
    a = encode_as_uuid("hello,world!")
    b = encode_as_uuid("hello,world!")
    assert a == b
    assert isinstance(uuid.UUID(a), uuid.UUID)


def test_parse_request_response_latest():
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
    with mock.patch("sentry.utils.metrics.timing") as timing:
        parse_replay_actions(1, "1", 30, events)
        assert timing.call_args_list == [
            mock.call("replays.usecases.ingest.request_body_size", 2949),
            mock.call("replays.usecases.ingest.response_body_size", 94),
        ]


def test_parse_request_response_no_info():
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
                    },
                },
            },
        },
    ]
    parse_replay_actions(1, "1", 30, events)
    # just make sure we don't raise


def test_parse_request_response_old_format_request_only():
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
                        "requestBodySize": 1002,
                    },
                },
            },
        },
    ]
    with mock.patch("sentry.utils.metrics.timing") as timing:
        parse_replay_actions(1, "1", 30, events)
        assert timing.call_args_list == [
            mock.call("replays.usecases.ingest.request_body_size", 1002),
        ]


def test_parse_request_response_old_format_response_only():
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
    with mock.patch("sentry.utils.metrics.timing") as timing:
        parse_replay_actions(1, "1", 30, events)
        assert timing.call_args_list == [
            mock.call("replays.usecases.ingest.response_body_size", 1002),
        ]


def test_parse_request_response_old_format_request_and_response():
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
    with mock.patch("sentry.utils.metrics.timing") as timing:
        parse_replay_actions(1, "1", 30, events)
        assert timing.call_args_list == [
            mock.call("replays.usecases.ingest.request_body_size", 1002),
            mock.call("replays.usecases.ingest.response_body_size", 8001),
        ]


def test_log_sdk_options():
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
    log = events[0]["data"]["payload"].copy()
    log["project_id"] = 1
    log["replay_id"] = "1"

    with mock.patch("sentry.replays.usecases.ingest.dom_index.logger") as logger, mock.patch(
        "random.randint"
    ) as randint:
        randint.return_value = 0
        parse_replay_actions(1, "1", 30, events)
        assert logger.info.call_args_list == [mock.call("SDK Options:", extra=log)]


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
