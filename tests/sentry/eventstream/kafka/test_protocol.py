import pytest

from sentry.eventstream.kafka.protocol import (
    InvalidPayload,
    InvalidVersion,
    UnexpectedOperation,
    get_task_kwargs_for_message,
    get_task_kwargs_for_message_from_headers,
)
from sentry.testutils.helpers import override_options
from sentry.utils import json


@override_options({"post-process-forwarder:rapidjson": False})
def test_get_task_kwargs_for_message_invalid_payload():
    with pytest.raises(InvalidPayload):
        get_task_kwargs_for_message(b'{"format": "invalid"}')


@override_options({"post-process-forwarder:rapidjson": False})
def test_get_task_kwargs_for_message_invalid_version():
    with pytest.raises(InvalidVersion):
        get_task_kwargs_for_message(json.dumps([0, "insert", {}]).encode())


@pytest.mark.django_db
def test_get_task_kwargs_for_message_version_1():
    event_data = {
        "project_id": 1,
        "group_id": 2,
        "event_id": "00000000000010008080808080808080",
        "message": "message",
        "platform": "python",
        "datetime": "2018-07-20T21:04:27.600640Z",
        "data": {
            "logentry": {"formatted": "message"},
            "platform": "python",
            "timestamp": 1532120667.60064,
        },
        "extra": {},
        "primary_hash": "49f68a5c8493ec2c0bf489821c21fc3b",
        "occurrence_id": "123456",
    }

    task_state = {
        "is_new": True,
        "is_regression": False,
        "is_new_group_environment": True,
        "queue": "post_process_errors",
    }

    kwargs = get_task_kwargs_for_message(json.dumps([1, "insert", event_data, task_state]).encode())
    assert kwargs is not None
    assert kwargs.pop("project_id") == 1
    assert kwargs.pop("event_id") == "00000000000010008080808080808080"
    assert kwargs.pop("group_id") == 2
    assert kwargs.pop("primary_hash") == "49f68a5c8493ec2c0bf489821c21fc3b"

    assert kwargs.pop("is_new") is True
    assert kwargs.pop("is_regression") is False
    assert kwargs.pop("is_new_group_environment") is True
    assert kwargs.pop("group_states") is None
    assert kwargs.pop("queue") == "post_process_errors"
    assert kwargs.pop("occurrence_id") == "123456"

    assert not kwargs, f"unexpected values remaining: {kwargs!r}"


@override_options({"post-process-forwarder:rapidjson": False})
def test_get_task_kwargs_for_message_version_1_skip_consume():
    assert (
        get_task_kwargs_for_message(json.dumps([1, "insert", {}, {"skip_consume": True}]).encode())
        is None
    )


@override_options({"post-process-forwarder:rapidjson": False})
def test_get_task_kwargs_for_message_version_1_unsupported_operation():
    assert get_task_kwargs_for_message(json.dumps([1, "delete", {}]).encode()) is None


@override_options({"post-process-forwarder:rapidjson": False})
def test_get_task_kwargs_for_message_version_1_unexpected_operation():
    with pytest.raises(UnexpectedOperation):
        get_task_kwargs_for_message(json.dumps([1, "invalid", {}, {}]).encode())


@pytest.mark.django_db
def test_get_task_kwargs_for_message_version_1_kafka_headers():
    kafka_headers = [
        ("Received-Timestamp", b"1626301534.910839"),
        ("event_id", b"00000000000010008080808080808080"),
        ("project_id", b"1"),
        ("is_new", b"1"),
        ("is_new_group_environment", b"1"),
        ("is_regression", b"0"),
        ("version", b"2"),
        ("operation", b"insert"),
        ("skip_consume", b"0"),
        ("queue", b"post_process_errors"),
        ("occurrence_id", b"1234"),
    ]

    kwargs = get_task_kwargs_for_message_from_headers(kafka_headers)
    assert kwargs is not None
    assert kwargs["project_id"] == 1
    assert kwargs["event_id"] == "00000000000010008080808080808080"
    assert kwargs["group_id"] is None
    assert kwargs["primary_hash"] is None
    assert kwargs["is_new"] is True
    assert kwargs["is_regression"] is False
    assert kwargs["is_new_group_environment"] is True
    assert kwargs["queue"] == "post_process_errors"
    assert kwargs["occurrence_id"] == "1234"
