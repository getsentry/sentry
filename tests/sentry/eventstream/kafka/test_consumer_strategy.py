import time
from datetime import datetime
from unittest.mock import Mock, patch

import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import Message, Partition, Topic

from sentry.eventstream.kafka.consumer_strategy import PostProcessForwarderStrategyFactory
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
        ),
        headers=[],
    )


@pytest.mark.django_db
@patch("sentry.eventstream.kafka.consumer_strategy.dispatch_post_process_group_task")
def test_dispatch_task(mock_dispatch: Mock) -> None:
    commit = Mock()
    partition = Partition(Topic("test"), 0)
    factory = PostProcessForwarderStrategyFactory(concurrency=2, max_pending_futures=10)
    strategy = factory.create_with_partitions(commit, {partition: 0})

    strategy.submit(Message(partition, 1, get_kafka_payload(), datetime.now()))
    strategy.poll()

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
    )

    strategy.join()
    strategy.close()
