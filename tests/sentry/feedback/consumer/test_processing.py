from __future__ import annotations

import datetime
import uuid
from typing import Any
from unittest.mock import Mock

import msgpack
import pytest
from arroyo.types import Partition, Topic

from sentry.conf.types.kafka_definition import Topic as TopicNames
from sentry.event_manager import EventManager
from sentry.ingest.types import ConsumerType
from sentry.testutils.pytest.fixtures import django_db_all
from tests.sentry.feedback.consumer.test_utils import make_broker_message, make_ingest_message

"""
Based on test_ingest_consumer_processing.py. Feedback uses the same IngestStrategyFactory as Events,
but moving its tests here makes it easier to migrate to a separate StrategyFactory later.
"""


def get_normalized_event(data, project):
    # Based on test_ingest_consumer_processing.py
    mgr = EventManager(data, project=project)
    mgr.normalize()
    return dict(mgr.get_data())


@pytest.fixture
def create_feedback_issue(monkeypatch):
    mock = Mock()
    monkeypatch.setattr("sentry.ingest.consumer.processors.create_feedback_issue", mock)
    return mock


@pytest.fixture
def preprocess_event(monkeypatch):
    mock = Mock()
    monkeypatch.setattr("sentry.ingest.consumer.processors.preprocess_event", mock)
    return mock


@django_db_all
def test_processing_calls_create_feedback_issue(
    default_project,
    feedback_strategy_factory_cls,
    create_feedback_issue,
    preprocess_event,
    monkeypatch,
):
    monkeypatch.setattr("sentry.features.has", lambda *a, **kw: True)

    project_id = default_project.id
    now = datetime.datetime.now()
    event: dict[str, Any] = {
        "event_id": uuid.uuid4().hex,
        "type": "feedback",
        "timestamp": now.isoformat(),
        "start_timestamp": now.isoformat(),
        "spans": [],
        "contexts": {
            "feedback": {
                "contact_email": "test_test.com",
                "message": "I really like this user-feedback feature!",
                "replay_id": "ec3b4dc8b79f417596f7a1aa4fcca5d2",
                "url": "https://docs.sentry.io/platforms/javascript/",
                "name": "Colton Allen",
                "type": "feedback",
            },
        },
    }

    strategy_factory = feedback_strategy_factory_cls(
        ConsumerType.Feedback,
        reprocess_only_stuck_events=False,
        num_processes=1,
        max_batch_size=1,
        max_batch_time=1,
        input_block_size=None,
        output_block_size=None,
    )
    strategy = strategy_factory.create_with_partitions(Mock(), Mock())
    partition = Partition(Topic(TopicNames.INGEST_FEEDBACK_EVENTS.value), 0)
    offset = 5

    ingest_message, _ = make_ingest_message(event, default_project, normalize=True)
    kafka_payload = msgpack.packb(ingest_message)
    message = make_broker_message(kafka_payload, partition, offset)
    strategy.submit(message)

    assert create_feedback_issue.call_count == 1
    assert (
        create_feedback_issue.call_args[0][0]["contexts"]["feedback"]
        == event["contexts"]["feedback"]
    )
    assert create_feedback_issue.call_args[0][0]["type"] == "feedback"
    assert create_feedback_issue.call_args[0][1] == project_id

    # preprocess_event is for error events only, make sure it wasn't called
    assert preprocess_event.call_count == 0
