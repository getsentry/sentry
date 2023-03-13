import zlib

from sentry.utils import json
from src.sentry.replays.usecases.ingest.dom_index import (
    decompress,
    iter_user_actions,
    parse_replay_actions,
)


def test_decompress():
    """Test "decompress" function."""
    data = b"[]"
    assert decompress(data) == data

    compressed_data = zlib.compress(data)
    assert decompress(compressed_data) == data


def test_iter_user_actions():
    """Test "iter_user_actions" function."""
    data = [
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
                                "aria-role": "something",
                                "role": "button",
                            },
                            "textContent": "Hello, world!",
                        },
                    },
                },
            },
        }
    ]

    user_actions = list(iter_user_actions(zlib.compress(json.dumps(data).encode())))
    assert len(user_actions) == 1
    assert user_actions[0]["dom_action"] == "click"
    assert user_actions[0]["dom_element"] == "div"
    assert user_actions[0]["dom_id"] == "hello"
    assert user_actions[0]["dom_classes"] == ["hello", "world"]
    assert user_actions[0]["dom_aria_label"] == "test"
    assert user_actions[0]["dom_aria_role"] == "something"
    assert user_actions[0]["dom_role"] == "button"
    assert user_actions[0]["dom_text_content"] == "Hello, world!"
    assert user_actions[0]["dom_node_id"] == 1
    assert user_actions[0]["timestamp"] == 1674298825
    assert len(user_actions[0]["event_hash"]) == 32


def test_parse_replay_actions():
    event = [
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
                                "aria-role": "aria-button",
                                "aria-label": "test",
                            },
                            "textContent": "text",
                        },
                    },
                },
            },
        }
    ]
    replay_actions = parse_replay_actions(1, "1", 0, 30, json.dumps(event).encode())

    assert replay_actions["type"] == "replay_event"
    assert isinstance(replay_actions["start_time"], float)
    assert replay_actions["replay_id"] == "1"
    assert replay_actions["project_id"] == 1
    assert replay_actions["retention_days"] == 30
    assert isinstance(replay_actions["payload"], list)

    payload = json.loads(bytes(replay_actions["payload"]))
    assert payload["type"] == "replay_actions"
    assert payload["replay_id"] == "1"
    assert payload["segment_id"] == 0
    assert len(payload["actions"]) == 1

    action = payload["actions"][0]
    assert action["dom_action"] == "click"
    assert action["dom_element"] == "div"
    assert action["dom_id"] == "id"
    assert action["dom_classes"] == ["class1", "class2"]
    assert action["dom_aria_label"] == "test"
    assert action["dom_aria_role"] == "aria-button"
    assert action["dom_role"] == "button"
    assert action["dom_text_content"] == "text"
    assert action["dom_node_id"] == 59
    assert action["timestamp"] == 1
    assert len(action["event_hash"]) == 32
