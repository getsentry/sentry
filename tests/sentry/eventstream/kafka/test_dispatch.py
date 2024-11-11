import time
from datetime import datetime
from unittest.mock import Mock, patch

import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition, Topic

from sentry.eventstream.kafka.dispatch import _get_task_kwargs_and_dispatch
from sentry.utils import json


def get_kafka_payload() -> KafkaPayload:
    return KafkaPayload(
        key=None,
        value=json.dumps(
            [
                2,
                "insert",
                {
                    "group_id": 43,
                    "event_id": "fe0ee9a2bc3b415497bad68aaf70dc7f",
                    "organization_id": 1,
                    "project_id": 1,
                    "primary_hash": "311ee66a5b8e697929804ceb1c456ffe",
                },
                {
                    "is_new": False,
                    "is_regression": None,
                    "is_new_group_environment": False,
                    "queue": "post_process_errors",
                    "skip_consume": False,
                },
            ]
        ).encode(),
        headers=[],
    )


def get_occurrence_kafka_payload() -> KafkaPayload:
    return KafkaPayload(
        key=None,
        value=json.dumps(
            [
                2,
                "insert",
                {
                    "group_id": 44,
                    "event_id": "066f15fe1cd2406aaa7c6a07471d7aef",
                    "organization_id": 2,
                    "project_id": 2,
                    "primary_hash": "2ec9f0faba66dc0b356aebf1621fd25e",
                    "occurrence_id": "0c6d75ac396941e0bc4b33c2ff7f3657",
                },
                {
                    "is_new": False,
                    "is_regression": None,
                    "is_new_group_environment": False,
                    "queue": "post_process_issue_platform",
                    "skip_consume": False,
                },
            ]
        ).encode(),
        headers=[],
    )


@pytest.mark.django_db
@patch("sentry.eventstream.kafka.dispatch.dispatch_post_process_group_task")
def test_dispatch_task(mock_dispatch: Mock) -> None:
    partition = Partition(Topic("test"), 0)
    dispatch_function = _get_task_kwargs_and_dispatch

    message = Message(BrokerValue(get_kafka_payload(), partition, 1, datetime.now()))

    dispatch_function(message)

    # Dispatch can take a while
    for _i in range(0, 5):
        if mock_dispatch.call_count:
            break
        time.sleep(0.1)

    mock_dispatch.assert_called_once_with(
        event_id="fe0ee9a2bc3b415497bad68aaf70dc7f",
        project_id=1,
        group_id=43,
        primary_hash="311ee66a5b8e697929804ceb1c456ffe",
        is_new=False,
        is_regression=None,
        is_new_group_environment=False,
        queue="post_process_errors",
        group_states=None,
        occurrence_id=None,
        eventstream_type=None,
    )


@pytest.mark.django_db
@patch("sentry.tasks.post_process.post_process_group.apply_async")
def test_dispatch_task_with_occurrence(mock_post_process_group: Mock) -> None:
    dispatch_function = _get_task_kwargs_and_dispatch

    partition = Partition(Topic("test-occurrence"), 0)

    dispatch_function(
        Message(BrokerValue(get_occurrence_kafka_payload(), partition, 1, datetime.now()))
    )

    # Dispatch can take a while
    for _i in range(0, 5):
        if mock_post_process_group.call_count:
            break
        time.sleep(0.1)

    assert mock_post_process_group.call_count == 1
    assert mock_post_process_group.call_args.kwargs == {
        "kwargs": {
            "cache_key": "e:066f15fe1cd2406aaa7c6a07471d7aef:2",
            "eventstream_type": None,
            "group_id": 44,
            "group_states": None,
            "is_new": False,
            "is_new_group_environment": False,
            "is_regression": None,
            "occurrence_id": "0c6d75ac396941e0bc4b33c2ff7f3657",
            "primary_hash": "2ec9f0faba66dc0b356aebf1621fd25e",
            "project_id": 2,
        },
        "queue": "post_process_issue_platform",
    }
