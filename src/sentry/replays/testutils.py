import datetime
import typing
import uuid
from enum import Enum

from sentry.utils import json


# This __must__ match the EventType enum in RRWeb, for the version of rrweb that we are using.
# https://github.com/rrweb-io/rrweb/blob/master/packages/rrweb/src/types.ts#L18-L26
class EventType(Enum):
    DomContentLoaded = 0
    Load = 1
    FullSnapshot = 2
    IncrementalSnapshot = 3
    Meta = 4
    Custom = 5
    Plugin = 6


SegmentList = typing.Iterable[typing.Dict[str, typing.Any]]
RRWebNode = typing.Dict[str, typing.Any]


def sec(timestamp: datetime.datetime):
    # sentry data inside rrweb is recorded in seconds
    return int(timestamp.timestamp())


def ms(timestamp: datetime.datetime):
    return int(timestamp.timestamp()) * 1000


def assert_expected_response(
    response: typing.Dict[str, typing.Any], expected_response: typing.Dict[str, typing.Any]
) -> None:
    """Assert a received response matches what was expected."""
    # Compare the response structure and values to the expected response.
    for key, value in expected_response.items():
        assert key in response, f"key: {key}"
        response_value = response.pop(key)

        if isinstance(response_value, dict):
            assert isinstance(value, dict)
            for k, v in value.items():
                if isinstance(v, list):
                    assert sorted(response_value[k]) == sorted(v)
                else:
                    assert response_value[k] == v, f"value: {v}, expected: {response_value[k]}"
        elif isinstance(response_value, list):
            assert len(response_value) == len(value), f'"{response_value}" "{value}"'
            for item in response_value:
                assert item in value, f"{key}, {item}"
                value.remove(item)
        else:
            assert response_value == value, f'"{key}, {response_value}" "{value}"'

    # Ensure no lingering unexpected keys exist.
    assert list(response.keys()) == [], response.keys()


def mock_expected_response(
    project_id: str,
    replay_id: str,
    started_at: datetime.datetime,
    finished_at: datetime.datetime,
    **kwargs: typing.Dict[str, typing.Any],
) -> typing.Dict[str, typing.Any]:
    urls = kwargs.pop("urls", [])
    return {
        "id": replay_id,
        "replay_type": kwargs.pop("replay_type", "session"),
        "project_id": str(project_id),
        "urls": urls,
        "error_ids": kwargs.pop("error_ids", ["a3a62ef6ac86415b83c2416fc2f76db1"]),
        "trace_ids": kwargs.pop("trace_ids", ["4491657243ba4dbebd2f6bd62b733080"]),
        "started_at": datetime.datetime.strftime(started_at, "%Y-%m-%dT%H:%M:%S+00:00"),
        "finished_at": datetime.datetime.strftime(finished_at, "%Y-%m-%dT%H:%M:%S+00:00"),
        "duration": (finished_at - started_at).seconds,
        "count_errors": kwargs.pop("count_errors", 1),
        "count_segments": kwargs.pop("count_segments", 1),
        "count_urls": len(urls),
        "platform": kwargs.pop("platform", "javascript"),
        "environment": kwargs.pop("environment", "production"),
        "releases": kwargs.pop("releases", ["version@1.3"]),
        "dist": kwargs.pop("dist", "abc123"),
        "os": {
            "name": kwargs.pop("os_name", "iOS"),
            "version": kwargs.pop("os_version", "16.2"),
        },
        "browser": {
            "name": kwargs.pop("browser_name", "Chrome"),
            "version": kwargs.pop("browser_version", "103.0.38"),
        },
        "device": {
            "name": kwargs.pop("device_name", "iPhone 13 Pro"),
            "brand": kwargs.pop("device_brand", "Apple"),
            "family": kwargs.pop("device_family", "iPhone"),
            "model": kwargs.pop("device_model", "13 Pro"),
        },
        "sdk": {
            "name": kwargs.pop("sdk_name", "sentry.javascript.react"),
            "version": kwargs.pop("sdk_version", "6.18.1"),
        },
        "user": {
            "id": kwargs.pop("user_id", "123"),
            "display_name": kwargs.pop("user_display_name", "username"),
            "email": kwargs.pop("user_email", "username@example.com"),
            "username": kwargs.pop("user_name", "username"),
            "ip": kwargs.pop("user_ip", "127.0.0.1"),
        },
        "tags": kwargs.pop("tags", {}),
        "activity": kwargs.pop("activity", 0),
        "is_archived": kwargs.pop("is_archived", False),
    }


def mock_replay(
    timestamp: datetime.datetime,
    project_id: str,
    replay_id: str,
    **kwargs: typing.Dict[str, typing.Any],
) -> typing.Dict[str, typing.Any]:
    tags = kwargs.pop("tags", {})
    tags.update({"transaction": kwargs.pop("title", "Title")})
    return {
        "type": "replay_event",
        "start_time": sec(timestamp),
        "replay_id": replay_id,
        "project_id": project_id,
        "retention_days": kwargs.pop("retention_days", 30),
        "payload": list(
            bytes(
                json.dumps(
                    {
                        "type": "replay_event",
                        "replay_id": replay_id,
                        "replay_type": kwargs.pop("replay_type", "session"),
                        "segment_id": kwargs.pop("segment_id", 0),
                        "tags": tags,
                        "urls": kwargs.pop("urls", []),
                        "is_archived": kwargs.pop("is_archived", None),
                        "error_ids": kwargs.pop(
                            "error_ids", ["a3a62ef6-ac86-415b-83c2-416fc2f76db1"]
                        ),
                        "trace_ids": kwargs.pop(
                            "trace_ids", ["44916572-43ba-4dbe-bd2f-6bd62b733080"]
                        ),
                        "dist": kwargs.pop("dist", "abc123"),
                        "platform": kwargs.pop("platform", "javascript"),
                        "timestamp": sec(timestamp),
                        "replay_start_timestamp": kwargs.pop(
                            "replay_start_timestamp", sec(timestamp)
                        ),
                        "environment": kwargs.pop("environment", "production"),
                        "release": kwargs.pop("release", "version@1.3"),
                        "user": {
                            "id": kwargs.pop("user_id", "123"),
                            "username": kwargs.pop("user_name", "username"),
                            "email": kwargs.pop("user_email", "username@example.com"),
                            "ip_address": kwargs.pop("ipv4", "127.0.0.1"),
                        },
                        "sdk": {
                            "name": kwargs.pop("sdk_name", "sentry.javascript.react"),
                            "version": kwargs.pop("sdk_version", "6.18.1"),
                        },
                        "contexts": {
                            "trace": {
                                "op": "pageload",
                                "span_id": "affa5649681a1eeb",
                                "trace_id": kwargs.pop(
                                    "trace_id", "23eda6cd4b174ef8a51f0096df3bfdd1"
                                ),
                            },
                            "os": {
                                "name": kwargs.pop("os_name", "iOS"),
                                "version": kwargs.pop("os_version", "16.2"),
                            },
                            "browser": {
                                "name": kwargs.pop("browser_name", "Chrome"),
                                "version": kwargs.pop("browser_version", "103.0.38"),
                            },
                            "device": {
                                "name": kwargs.pop("device_name", "iPhone 13 Pro"),
                                "brand": kwargs.pop("device_brand", "Apple"),
                                "family": kwargs.pop("device_family", "iPhone"),
                                "model": kwargs.pop("device_model", "13 Pro"),
                            },
                        },
                        "request": {
                            "url": "Doesn't matter not ingested.",
                            "headers": {"User-Agent": kwargs.pop("user_agent", "Firefox")},
                        },
                        "extra": {},
                    }
                ).encode()
            )
        ),
    }


def mock_replay_click(
    timestamp: datetime.datetime,
    project_id: str,
    replay_id: str,
    **kwargs: typing.Dict[str, typing.Any],
) -> typing.Dict[str, typing.Any]:
    return {
        "type": "replay_event",
        "start_time": sec(timestamp),
        "replay_id": replay_id,
        "project_id": project_id,
        "retention_days": kwargs.pop("retention_days", 30),
        "payload": list(
            bytes(
                json.dumps(
                    {
                        "type": "replay_actions",
                        "replay_id": replay_id,
                        "clicks": [
                            {
                                "node_id": kwargs["node_id"],
                                "tag": kwargs["tag"],
                                "id": kwargs.pop("id", ""),
                                "class": kwargs.pop("class_", []),
                                "text": kwargs.pop("text", ""),
                                "role": kwargs.pop("role", ""),
                                "alt": kwargs.pop("alt", ""),
                                "testid": kwargs.pop("testid", ""),
                                "aria_label": kwargs.pop("aria_label", ""),
                                "title": kwargs.pop("title", ""),
                                "event_hash": str(uuid.uuid4()),
                                "timestamp": sec(timestamp),
                            }
                        ],
                    }
                ).encode()
            )
        ),
    }


def mock_segment_init(
    timestamp: datetime.datetime,
    href: str = "http://localhost/",
    width: int = 800,
    height: int = 600,
) -> SegmentList:
    return [
        {
            "type": EventType.DomContentLoaded,
            "timestamp": ms(timestamp),  # rrweb timestamps are in ms
        },
        {
            "type": EventType.Load,
            "timestamp": ms(timestamp),  # rrweb timestamps are in ms
        },
        {
            "type": EventType.Meta,
            "data": {"href": href, "width": width, "height": height},
            "timestamp": ms(timestamp),  # rrweb timestamps are in ms
        },
    ]


def mock_segment_fullsnapshot(timestamp: datetime.datetime, bodyChildNodes) -> SegmentList:
    bodyNode = mock_rrweb_node(
        tagName="body",
        attributes={
            "style": 'margin:0; font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu;',
        },
        childNodes=bodyChildNodes,
    )
    htmlNode = mock_rrweb_node(
        tagName="html",
        childNodes=[bodyNode],
    )

    return [
        {
            "type": EventType.FullSnapshot,
            "data": {
                "timestamp": ms(timestamp),  # rrweb timestamps are in ms
                "node": {
                    "type": EventType.DomContentLoaded,
                    "childNodes": [htmlNode],
                },
            },
        }
    ]


def mock_segment_console(timestamp: datetime.datetime) -> SegmentList:
    return [
        {
            "type": EventType.Custom,
            "timestamp": ms(timestamp),  # rrweb timestamps are in ms
            "data": {
                "tag": "breadcrumb",
                "payload": {
                    "timestamp": sec(timestamp),  # sentry data inside rrweb is in seconds
                    "type": "default",
                    "category": "console",
                    "data": {
                        "arguments": [
                            "./src/pages/template/Header.js\n  Line 14:  The href attribute requires a valid value to be accessible. Provide a valid, navigable address as the href value."
                        ],
                        "logger": "console",
                    },
                    "level": "warning",
                    "message": "./src/pages/template/Header.js\n  Line 14:  The href attribute requires a valid value to be accessible. Provide a valid, navigable address as the href value.",
                },
            },
        }
    ]


def mock_segment_breadcrumb(timestamp: datetime.datetime, payload) -> SegmentList:
    return [
        {
            "type": 5,
            "timestamp": ms(timestamp),  # rrweb timestamps are in ms
            "data": {
                "tag": "breadcrumb",
                "payload": payload,
            },
        }
    ]


def mock_segment_nagivation(
    timestamp: datetime.datetime, hrefFrom: str = "/", hrefTo: str = "/profile/"
) -> SegmentList:
    return mock_segment_breadcrumb(
        timestamp,
        {
            "timestamp": sec(timestamp),  # sentry data inside rrweb is in seconds
            "type": "default",
            "category": "navigation",
            "data": {"from": hrefFrom, "to": hrefTo},
        },
    )


__rrweb_id = 0


def next_rrweb_id():
    global __rrweb_id
    __rrweb_id += 1
    return __rrweb_id


def mock_rrweb_node(**kwargs: typing.Dict[str, typing.Any]) -> RRWebNode:
    id = kwargs.pop("id", next_rrweb_id())
    tagName = kwargs.pop("tagName", None)
    if tagName:
        return {
            "type": EventType.FullSnapshot,
            "id": id,
            "tagName": tagName,
            "attributes": kwargs.pop("attributes", {}),
            "childNodes": kwargs.pop("childNodes", []),
        }
    else:
        return {
            "type": EventType.IncrementalSnapshot,
            "id": id,
            "textContent": kwargs.pop("textContent", ""),
        }


def mock_rrweb_div_helloworld() -> RRWebNode:
    return mock_rrweb_node(
        tagName="div",
        childNodes=[
            mock_rrweb_node(
                tagName="h1",
                attributes={"style": "text-align: center;"},
                childNodes=[mock_rrweb_node(textContent="Hello World")],
            ),
        ],
    )
