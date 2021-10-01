from unittest.mock import MagicMock, Mock, patch

import pytest

from sentry import options
from sentry.eventstream.kafka.postprocessworker import (
    _CONCURRENCY_OPTION,
    ErrorsPostProcessForwarderWorker,
    PostProcessForwarderWorker,
    TransactionsPostProcessForwarderWorker,
)
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


@pytest.fixture
def kafka_message_without_transaction_header(kafka_message_payload):
    mock_message = Mock()
    mock_message.headers = MagicMock(return_value=[("timestamp", b"12345")])
    mock_message.value = MagicMock(return_value=json.dumps(kafka_message_payload))
    mock_message.partition = MagicMock("1")
    return mock_message


@pytest.fixture
def kafka_message_with_transaction_header_false(kafka_message_payload):
    mock_message = Mock()
    mock_message.headers = MagicMock(
        return_value=[("timestamp", b"12345"), ("transaction_forwarder", b"0")]
    )
    mock_message.value = MagicMock(return_value=json.dumps(kafka_message_payload))
    mock_message.partition = MagicMock("1")
    return mock_message


@pytest.fixture
def kafka_message_with_transaction_header_true(kafka_message_payload):
    mock_message = Mock()
    mock_message.headers = MagicMock(
        return_value=[("timestamp", b"12345"), ("transaction_forwarder", b"1")]
    )
    mock_message.value = MagicMock(return_value=json.dumps(kafka_message_payload))
    mock_message.partition = MagicMock("1")
    return mock_message


@patch("sentry.eventstream.kafka.postprocessworker.dispatch_post_process_group_task")
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
    )

    forwarder.shutdown()


@pytest.mark.django_db
@patch("sentry.eventstream.kafka.postprocessworker.dispatch_post_process_group_task")
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
def test_post_process_forwarder_concurrency(kafka_message_payload):
    """
    Tests that the number of threads change when the option is changed.
    """
    forwarder = PostProcessForwarderWorker(concurrency=1)

    forwarder.flush_batch(None)
    assert forwarder._PostProcessForwarderWorker__current_concurrency == 1

    options.set(_CONCURRENCY_OPTION, 5)
    forwarder.flush_batch(None)
    assert forwarder._PostProcessForwarderWorker__current_concurrency == 5

    forwarder.shutdown()


@pytest.mark.django_db
@patch("sentry.eventstream.kafka.postprocessworker.dispatch_post_process_group_task")
def test_errors_post_process_forwarder_missing_headers(
    dispatch_post_process_group_task, kafka_message_without_transaction_header
):
    """
    Tests that the errors post process forwarder calls dispatch_post_process_group_task
    when the header "transaction_forwarder" is missing.
    """
    forwarder = ErrorsPostProcessForwarderWorker(concurrency=1)
    future = forwarder.process_message(kafka_message_without_transaction_header)
    assert future is not None

    forwarder.flush_batch([future])

    dispatch_post_process_group_task.assert_called_once_with(
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
def test_errors_post_process_forwarder_false_headers(
    dispatch_post_process_group_task, kafka_message_with_transaction_header_false
):
    """
    Test that the errors post process forwarder calls dispatch_post_process_group_task
    when the header "transaction_forwarder" is set to False.
    """
    forwarder = ErrorsPostProcessForwarderWorker(concurrency=1)
    future = forwarder.process_message(kafka_message_with_transaction_header_false)
    assert future is not None

    forwarder.flush_batch([future])

    dispatch_post_process_group_task.assert_called_once_with(
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
def test_errors_post_process_forwarder_true_headers(kafka_message_with_transaction_header_true):
    """
    Tests that the errors post process forwarder's process_message returns None
    when the header "transaction_forwarder" is set to True.
    """
    forwarder = ErrorsPostProcessForwarderWorker(concurrency=1)
    future = forwarder.process_message(kafka_message_with_transaction_header_true)

    assert future is None

    forwarder.shutdown()


@pytest.mark.django_db
def test_transactions_post_process_forwarder_missing_headers(
    kafka_message_without_transaction_header,
):
    """
    Tests that the transactions post process forwarder's process_message returns None
    when the header "transaction_forwarder" is missing.
    """
    forwarder = TransactionsPostProcessForwarderWorker(concurrency=1)
    future = forwarder.process_message(kafka_message_without_transaction_header)
    assert future is None

    forwarder.shutdown()


@pytest.mark.django_db
def test_transactions_post_process_forwarder_false_headers(
    kafka_message_with_transaction_header_false,
):
    """
    Tests that the transactions post process forwarder's process_message returns None
    when the header "transaction_forwarder" is set to False.
    """
    forwarder = TransactionsPostProcessForwarderWorker(concurrency=1)
    future = forwarder.process_message(kafka_message_with_transaction_header_false)
    assert future is None

    forwarder.shutdown()


@pytest.mark.django_db
@patch("sentry.eventstream.kafka.postprocessworker.dispatch_post_process_group_task")
def test_transactions_post_process_forwarder_true_headers(
    dispatch_post_process_group_task, kafka_message_with_transaction_header_true
):
    """
    Tests that the transactions post process forwarder calls dispatch_post_process_group_task
    when the header "transaction_forwarder" is set to True.
    """
    forwarder = TransactionsPostProcessForwarderWorker(concurrency=1)
    future = forwarder.process_message(kafka_message_with_transaction_header_true)

    assert future is not None
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
