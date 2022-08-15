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

        if isinstance(response_value, list):
            assert len(response_value) == len(value), f'"{response_value}" "{value}"'
            for item in response_value:
                assert item in value
                value.remove(item)
        else:
            assert response_value == value, f'"{response_value}" "{value}"'

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
        "errorIds": kwargs.pop("error_ids", []),
        "traceIds": kwargs.pop("trace_ids", []),
        "startedAt": datetime.datetime.strftime(started_at, "%Y-%m-%dT%H:%M:%S+00:00"),
        "finishedAt": datetime.datetime.strftime(finished_at, "%Y-%m-%dT%H:%M:%S+00:00"),
        "duration": (finished_at - started_at).seconds,
        "countErrors": kwargs.pop("count_errors", 0),
        "countSegments": kwargs.pop("count_segments", 1),
        "countUrls": len(urls),
        "longestTransaction": kwargs.pop("longest_transaction", 0),
        "platform": kwargs.pop("platform", "javascript"),
        "environment": kwargs.pop("environment", "production"),
        "release": kwargs.pop("release", "version@1.3"),
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
            "email": kwargs.pop("user_email", "username@example.com"),
            "name": kwargs.pop("user_name", "username"),
            "ip_address": kwargs.pop("user_ip_address", "127.0.0.1"),
        },
        "tags": {"customtag": "is_set"},
    }


def mock_replay(
    timestamp: datetime.datetime,
    project_id: str,
    replay_id: str,
    **kwargs: typing.Dict[str, typing.Any],
) -> typing.Dict[str, typing.Any]:
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
                        "tags": {
                            "customtag": "is_set",
                            "transaction": kwargs.pop("title", "Title"),
                        },
                        "urls": kwargs.pop("urls", []),
                        "error_ids": kwargs.pop("error_ids", []),
                        "trace_ids": kwargs.pop("trace_ids", []),
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
