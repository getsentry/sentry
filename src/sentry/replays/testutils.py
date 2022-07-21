import datetime
import logging
import typing

from sentry.utils import json


def assert_expected_response(
    response: typing.Dict[str, typing.Any], expected_response: typing.Dict[str, typing.Any]
) -> None:
    """Assert a received response matches what was expected."""
    logging.debug(json.dumps(response, indent=2))
    logging.debug(json.dumps(expected_response, indent=2))
    # Compare the response structure and values to the expected response.
    for key, value in expected_response.items():
        logging.debug(key)
        assert key in response
        assert response.pop(key) == value

    # Ensure no lingering unexpected keys exist.
    assert list(response.keys()) == []


def mock_expected_response(
    replay_id: str,
    started_at: datetime.datetime,
    finished_at: datetime.datetime,
    **kwargs: typing.Dict[str, typing.Any],
) -> typing.Dict[str, typing.Any]:
    urls = kwargs.pop("urls", [""])
    return {
        "replay_id": replay_id,
        "title": kwargs.pop("title", ""),
        "platform": kwargs.pop("platform", "javascript"),
        "environment": kwargs.pop("environment", ""),
        "release": kwargs.pop("release", ""),
        "dist": kwargs.pop("dist", "abc123"),
        "ip_address_v4": kwargs.pop("ip_address_v4", "127.0.0.1"),
        "ip_address_v6": kwargs.pop("ip_address_v6", "::"),
        "user": kwargs.pop("user", ""),
        "user_id": kwargs.pop("user_id", "123"),
        "user_email": kwargs.pop("user_email", "username@example.com"),
        "user_hash": kwargs.pop("user_hash", 0),
        "user_name": kwargs.pop("user_name", "username"),
        "sdk_name": kwargs.pop("sdk_name", "sentry.javascript.react"),
        "sdk_version": kwargs.pop("sdk_version", "6.18.1"),
        "trace_ids": kwargs.pop("trace_ids", []),
        "started_at": datetime.datetime.strftime(started_at, "%Y-%m-%dT%H:%M:%S+00:00"),
        "finished_at": datetime.datetime.strftime(finished_at, "%Y-%m-%dT%H:%M:%S+00:00"),
        "duration": (finished_at - started_at).seconds,
        "urls": urls,
        "count_urls": len(urls),
        "count_sequences": kwargs.pop("count_sequences", 1),
        "tags": {"isReplayRoot": "yes", "skippedNormalization": "True", "transaction": "/"},
        "count_errors": kwargs.pop("count_errors", 0),
        "longest_transaction": kwargs.pop("longest_transaction", 0),
    }


def mock_replay(
    timestamp: datetime.datetime,
    project_id: str,
    replay_id: str,
    **kwargs: typing.Dict[str, typing.Any],
) -> typing.Dict[str, typing.Any]:
    return {
        "datetime": int(timestamp.timestamp()),
        "platform": "javascript",
        "project_id": project_id,
        "replay_id": replay_id,
        "retention_days": 20,
        "sequence_id": kwargs.pop("sequence_id", 0),
        "trace_ids": kwargs.pop("trace_ids", []),
        "data": {
            "timestamp": int(timestamp.timestamp()),
            "replay_id": replay_id,
            "environment": kwargs.pop("environment", "production"),
            "project_id": project_id,
            "release": kwargs.pop("release", "version@1.3"),
            "dist": kwargs.pop("dist", "abc123"),
            "sdk": {
                "name": kwargs.pop("sdk_name", "sentry.javascript.react"),
                "version": kwargs.pop("sdk_version", "6.18.1"),
                "integrations": [
                    "InboundFilters",
                    "FunctionToString",
                    "TryCatch",
                    "Breadcrumbs",
                    "GlobalHandlers",
                    "LinkedErrors",
                    "Dedupe",
                    "UserAgent",
                    "Replay",
                    "BrowserTracing",
                ],
                "packages": [{"name": "npm:@sentry/react", "version": "6.18.1"}],
            },
            "platform": kwargs.pop("platform", "javascript"),
            "version": "6.18.1",
            "type": "replay_event",
            "datetime": int(timestamp.timestamp()),
            "tags": [
                ["isReplayRoot", "yes"],
                ["skippedNormalization", "True"],
                ["transaction", "/"],
            ],
            "user": {
                "username": kwargs.pop("username", "username"),
                "ip_address": kwargs.pop("ip_address", "127.0.0.1"),
                "id": kwargs.pop("id", "123"),
                "email": kwargs.pop("email", "username@example.com"),
                "hash": kwargs.pop("hash", 123),
            },
            "title": kwargs.pop("title", "test"),
        },
    }
