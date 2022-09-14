import datetime
import typing

from sentry.utils import json


def assert_expected_response(
    response: typing.Dict[str, typing.Any], expected_response: typing.Dict[str, typing.Any]
) -> None:
    """Assert a received response matches what was expected."""
    # Compare the response structure and values to the expected response.
    for key, value in expected_response.items():
        assert key in response, key
        response_value = response.pop(key)

        if isinstance(response_value, dict):
            assert isinstance(value, dict)
            for k, v in value.items():
                if isinstance(v, list):
                    assert sorted(response_value[k]) == sorted(v)
                else:
                    assert response_value[k] == v
        elif isinstance(response_value, list):
            assert len(response_value) == len(value), f'"{response_value}" "{value}"'
            for item in response_value:
                assert item in value, f"{key}, {item}"
                value.remove(item)
        else:
            assert response_value == value, f'"{key}, {response_value}" "{value}"'

    # Ensure no lingering unexpected keys exist.
    assert list(response.keys()) == []


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
        "title": kwargs.pop("title", "Title"),
        "projectId": str(project_id),
        "urls": urls,
        "errorIds": kwargs.pop("error_ids", ["a3a62ef6ac86415b83c2416fc2f76db1"]),
        "traceIds": kwargs.pop("trace_ids", ["4491657243ba4dbebd2f6bd62b733080"]),
        "startedAt": datetime.datetime.strftime(started_at, "%Y-%m-%dT%H:%M:%S+00:00"),
        "finishedAt": datetime.datetime.strftime(finished_at, "%Y-%m-%dT%H:%M:%S+00:00"),
        "duration": (finished_at - started_at).seconds,
        "countErrors": kwargs.pop("count_errors", 1),
        "countSegments": kwargs.pop("count_segments", 1),
        "countUrls": len(urls),
        "longestTransaction": kwargs.pop("longest_transaction", 0),
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
            "displayName": kwargs.pop("user_display_name", "username"),
            "email": kwargs.pop("user_email", "username@example.com"),
            "name": kwargs.pop("user_name", "username"),
            "ip_address": kwargs.pop("user_ip_address", "127.0.0.1"),
        },
        "tags": kwargs.pop("tags", {}),
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
        "start_time": int(timestamp.timestamp()),
        "replay_id": replay_id,
        "project_id": project_id,
        "retention_days": 30,
        "payload": list(
            bytes(
                json.dumps(
                    {
                        "type": "replay_event",
                        "replay_id": replay_id,
                        "segment_id": kwargs.pop("segment_id", 0),
                        "tags": tags,
                        "urls": kwargs.pop("urls", []),
                        "error_ids": kwargs.pop(
                            "error_ids", ["a3a62ef6-ac86-415b-83c2-416fc2f76db1"]
                        ),
                        "trace_ids": kwargs.pop(
                            "trace_ids", ["44916572-43ba-4dbe-bd2f-6bd62b733080"]
                        ),
                        "dist": kwargs.pop("dist", "abc123"),
                        "platform": kwargs.pop("platform", "javascript"),
                        "timestamp": int(timestamp.timestamp()),
                        "replay_start_timestamp": kwargs.pop(
                            "replay_start_timestamp", int(timestamp.timestamp())
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
