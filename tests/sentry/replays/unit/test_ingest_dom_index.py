import uuid

from sentry.utils import json
from src.sentry.replays.usecases.ingest.dom_index import (
    encode_as_uuid,
    get_user_actions,
    parse_replay_actions,
)


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

    user_actions = get_user_actions(uuid.uuid4().hex, events)
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
