from unittest.mock import MagicMock, Mock, patch

import pytest

from sentry import options
from sentry.eventstream.kafka.postprocessworker import PostProcessForwarderWorker
from sentry.eventstream.kafka.protocol import InvalidVersion
from sentry.utils import json


@pytest.fixture
def kafka_message_payload():
    return [
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
            "skip_consume": False,
        },
    ]


@patch("sentry.eventstream.kafka.postprocessworker.dispatch_post_process_group_task")
def test_post_process_forwarder(dispatch_post_process_group_task, kafka_message_payload):
    """
    Test that the post process forwarder calls dispatch_post_process_group_task with the correct arguments
    """
    forwarder = PostProcessForwarderWorker(concurrency=1)

    mock_message = Mock()
    mock_message.value = MagicMock(return_value=json.dumps(kafka_message_payload))
    mock_message.partition = MagicMock("1")

    future = forwarder.process_message(mock_message)

    forwarder.flush_batch([future])

    dispatch_post_process_group_task.assert_called_with(
        event_id="fe0ee9a2bc3b415497bad68aaf70dc7f",
        project_id=1,
        group_id=43,
        primary_hash="311ee66a5b8e697929804ceb1c456ffe",
        is_new=False,
        is_regression=None,
        is_new_group_environment=False,
    )

    forwarder.shutdown()


@pytest.mark.django_db
@patch("sentry.eventstream.kafka.postprocessworker.dispatch_post_process_group_task")
def test_post_process_forwarder_bad_message_headers(
    dispatch_post_process_group_task, kafka_message_payload
):
    """
    Test that when bad message headers are received, post process forwarder still works if the payload is valid.
    """
    forwarder = PostProcessForwarderWorker(concurrency=1)

    mock_message = Mock()
    mock_message.headers = MagicMock(return_value="this does not work")
    mock_message.value = MagicMock(return_value=json.dumps(kafka_message_payload))
    mock_message.partition = MagicMock("1")

    options.set("post-process-forwarder:kafka-headers", True)
    future = forwarder.process_message(mock_message)

    forwarder.flush_batch([future])

    dispatch_post_process_group_task.assert_called_with(
        event_id="fe0ee9a2bc3b415497bad68aaf70dc7f",
        project_id=1,
        group_id=43,
        primary_hash="311ee66a5b8e697929804ceb1c456ffe",
        is_new=False,
        is_regression=None,
        is_new_group_environment=False,
    )

    forwarder.shutdown()


def test_post_process_forwarder_bad_message(kafka_message_payload):
    """
    Test that exception is thrown during flush_batch calls when a bad message is received.
    """
    forwarder = PostProcessForwarderWorker(concurrency=1)

    # Use a version which does not exist to create a bad message
    kafka_message_payload[0] = 100
    mock_message = Mock()
    mock_message.value = MagicMock(return_value=json.dumps(kafka_message_payload))
    mock_message.partition = MagicMock("1")

    future = forwarder.process_message(mock_message)

    with pytest.raises(InvalidVersion):
        forwarder.flush_batch([future])

    forwarder.shutdown()
