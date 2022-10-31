from unittest.mock import MagicMock, Mock, patch

import pytest

import sentry.tasks.post_process
from sentry import options
from sentry.eventstream.kafka.postprocessworker import PostProcessForwarderWorker
from sentry.eventstream.kafka.protocol import InvalidVersion
from sentry.testutils.helpers import TaskRunner
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
            "queue": "post_process_errors",
            "skip_consume": False,
            "group_states": [
                {
                    "id": 43,
                    "is_new": False,
                    "is_regression": None,
                    "is_new_group_environment": False,
                }
            ],
        },
    ]


@pytest.fixture
def kafka_message_without_transaction_header(kafka_message_payload):
    mock_message = Mock()
    mock_message.headers = MagicMock(return_value=[("timestamp", b"12345")])
    mock_message.value = MagicMock(return_value=json.dumps(kafka_message_payload))
    mock_message.partition = MagicMock("1")
    return mock_message


@patch("sentry.eventstream.kafka.postprocessworker.dispatch_post_process_group_task", autospec=True)
def test_post_process_forwarder(
    dispatch_post_process_group_task, kafka_message_without_transaction_header
):
    """
    Tests that the post process forwarder calls dispatch_post_process_group_task with the correct arguments
    """
    forwarder = PostProcessForwarderWorker(concurrency=1)
    future = forwarder.process_message(kafka_message_without_transaction_header)

    forwarder.flush_batch([future])

    dispatch_post_process_group_task.assert_called_once_with(
        event_id="fe0ee9a2bc3b415497bad68aaf70dc7f",
        project_id=1,
        group_id=43,
        primary_hash="311ee66a5b8e697929804ceb1c456ffe",
        is_new=False,
        is_regression=None,
        is_new_group_environment=False,
        queue="post_process_errors",
        group_states=[
            {"id": 43, "is_new": False, "is_regression": None, "is_new_group_environment": False}
        ],
    )

    forwarder.shutdown()


@pytest.mark.django_db
@patch("sentry.eventstream.kafka.postprocessworker.dispatch_post_process_group_task", autospec=True)
def test_post_process_forwarder_bad_message_headers(
    dispatch_post_process_group_task, kafka_message_payload
):
    """
    Tests that when bad message headers are received, post process forwarder still works if the payload is valid.
    """
    forwarder = PostProcessForwarderWorker(concurrency=1)

    mock_message = Mock()
    mock_message.headers = MagicMock(return_value="this does not work")
    mock_message.value = MagicMock(return_value=json.dumps(kafka_message_payload))
    mock_message.partition = MagicMock("1")

    options.set("post-process-forwarder:kafka-headers", True)
    future = forwarder.process_message(mock_message)

    forwarder.flush_batch([future])

    dispatch_post_process_group_task.assert_called_once_with(
        event_id="fe0ee9a2bc3b415497bad68aaf70dc7f",
        project_id=1,
        group_id=43,
        primary_hash="311ee66a5b8e697929804ceb1c456ffe",
        is_new=False,
        is_regression=None,
        is_new_group_environment=False,
        queue="post_process_errors",
        group_states=[
            {"id": 43, "is_new": False, "is_regression": None, "is_new_group_environment": False}
        ],
    )

    forwarder.shutdown()


def test_post_process_forwarder_bad_message(kafka_message_payload):
    """
    Tests that exception is thrown during flush_batch calls when a bad message is received.
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


@pytest.mark.django_db
@patch(
    "sentry.eventstream.kafka.postprocessworker.post_process_group.apply_async",
    wraps=sentry.tasks.post_process.post_process_group.apply_async,
)
def test_errors_post_process_forwarder_calls_post_process_group(
    post_process_group_spy,
    kafka_message_without_transaction_header,
):
    forwarder = PostProcessForwarderWorker(concurrency=1)

    with TaskRunner():
        assert post_process_group_spy.call_count == 0

        future = forwarder.process_message(kafka_message_without_transaction_header)

        assert future is not None
        forwarder.flush_batch([future])

        assert post_process_group_spy.call_count == 1
        from sentry.utils.cache import cache_key_for_event

        group_state = dict(
            is_new=False,
            is_regression=None,
            is_new_group_environment=False,
        )

        assert post_process_group_spy.call_args.kwargs == dict(
            kwargs=dict(
                group_id=43,
                primary_hash="311ee66a5b8e697929804ceb1c456ffe",
                cache_key=cache_key_for_event(
                    {"project": str(1), "event_id": "fe0ee9a2bc3b415497bad68aaf70dc7f"}
                ),
                **group_state,
                group_states=[{"id": 43, **group_state}],
            ),
            queue="post_process_errors",
        )

    forwarder.shutdown()


@pytest.mark.django_db
@patch(
    "sentry.eventstream.kafka.postprocessworker.post_process_group.apply_async",
    wraps=sentry.tasks.post_process.post_process_group.apply_async,
)
def test_transactions_post_process_forwarder_calls_post_process_group(
    post_process_group_spy,
    kafka_message_without_transaction_header,
):
    forwarder = PostProcessForwarderWorker(concurrency=1)

    with TaskRunner():
        assert post_process_group_spy.call_count == 0

        future = forwarder.process_message(kafka_message_without_transaction_header)

        assert future is not None
        forwarder.flush_batch([future])

        assert post_process_group_spy.call_count == 1
        from sentry.utils.cache import cache_key_for_event

        group_state = dict(
            is_new=False,
            is_regression=None,
            is_new_group_environment=False,
        )

        assert post_process_group_spy.call_args.kwargs == dict(
            kwargs=dict(
                group_id=43,
                primary_hash="311ee66a5b8e697929804ceb1c456ffe",
                cache_key=cache_key_for_event(
                    {"project": str(1), "event_id": "fe0ee9a2bc3b415497bad68aaf70dc7f"}
                ),
                **group_state,
                group_states=[{"id": 43, **group_state}],
            ),
            queue="post_process_errors",
        )

    forwarder.shutdown()
