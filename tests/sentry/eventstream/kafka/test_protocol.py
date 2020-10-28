from __future__ import absolute_import

import pytest
import pytz
from datetime import datetime

from sentry.eventstream.kafka.protocol import (
    InvalidPayload,
    InvalidVersion,
    UnexpectedOperation,
    get_task_kwargs_for_message,
)
from sentry.utils import json


def test_get_task_kwargs_for_message_invalid_payload():
    with pytest.raises(InvalidPayload):
        get_task_kwargs_for_message('{"format": "invalid"}')


def test_get_task_kwargs_for_message_invalid_version():
    with pytest.raises(InvalidVersion):
        get_task_kwargs_for_message(json.dumps([0, "insert", {}]))


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
    }

    task_state = {"is_new": True, "is_regression": False, "is_new_group_environment": True}

    kwargs = get_task_kwargs_for_message(json.dumps([1, "insert", event_data, task_state]))
    event = kwargs.pop("event")
    assert event.project_id == 1
    assert event.group_id == 2
    assert event.event_id == "00000000000010008080808080808080"
    assert event.message == "message"
    assert event.platform == "python"
    assert event.datetime == datetime(2018, 7, 20, 21, 4, 27, 600640, tzinfo=pytz.utc)
    assert kwargs.pop("primary_hash") == "49f68a5c8493ec2c0bf489821c21fc3b"

    assert kwargs.pop("is_new") is True
    assert kwargs.pop("is_regression") is False
    assert kwargs.pop("is_new_group_environment") is True

    assert not kwargs, "unexpected values remaining: {!r}".format(kwargs)


def test_get_task_kwargs_for_message_version_1_skip_consume():
    assert (
        get_task_kwargs_for_message(json.dumps([1, "insert", {}, {"skip_consume": True}])) is None
    )


def test_get_task_kwargs_for_message_version_1_unsupported_operation():
    assert get_task_kwargs_for_message(json.dumps([1, "delete", {}])) is None


def test_get_task_kwargs_for_message_version_1_unexpected_operation():
    with pytest.raises(UnexpectedOperation):
        get_task_kwargs_for_message(json.dumps([1, "invalid", {}, {}]))
