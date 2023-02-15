from unittest.mock import MagicMock, Mock

import pytest

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
            "occurrence_id": None,
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


@pytest.fixture
def kafka_message_generic_event(kafka_message_payload):
    kafka_message_payload[2]["occurrence_id"] = "my id"
    del kafka_message_payload[3]["group_states"]
    kafka_message_payload[3]["is_new"] = True
    kafka_message_payload[3]["is_regression"] = False
    kafka_message_payload[3]["is_new_group_environment"] = True
    kafka_message_payload[3]["queue"] = "post_process_generic"

    mock_message = Mock()
    mock_message.headers = MagicMock(return_value=[("timestamp", b"12345")])
    mock_message.value = MagicMock(return_value=json.dumps(kafka_message_payload))
    mock_message.partition = MagicMock("1")
    return mock_message
