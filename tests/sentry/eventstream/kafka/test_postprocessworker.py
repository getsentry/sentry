from unittest.mock import MagicMock, Mock, patch

import pytest

from sentry.eventstream.kafka.postprocessworker import PostProcessForwarderWorker
from sentry.utils import json

test_message = [
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


@pytest.mark.django_db
@patch("sentry.eventstream.kafka.postprocessworker.dispatch_post_process_group_task")
def test_post_process_forwarder(dispatch_post_process_group_task):
    forwarder = PostProcessForwarderWorker(concurrency=1)

    mock_message = Mock()
    mock_message.value = MagicMock(return_value=json.dumps(test_message))
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
