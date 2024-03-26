from __future__ import annotations

import datetime
import time
from typing import Any
from unittest.mock import Mock

import pytest

from sentry.event_manager import EventManager
from sentry.ingest.consumer.processors import process_event
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import json

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
    default_project, create_feedback_issue, preprocess_event, monkeypatch
):
    # Tests the feedback branch of the ingest consumer process_event fx
    monkeypatch.setattr("sentry.features.has", lambda *a, **kw: True)

    project_id = default_project.id
    now = datetime.datetime.now()
    event: dict[str, Any] = {
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
    payload = get_normalized_event(event, default_project)
    event_id = payload["event_id"]
    start_time = time.time() - 3600

    process_event(
        {
            "payload": json.dumps(payload),
            "start_time": start_time,
            "event_id": event_id,
            "project_id": project_id,
            "remote_addr": "127.0.0.1",
        },
        project=default_project,
    )

    assert create_feedback_issue.call_count == 1
    assert (
        create_feedback_issue.call_args[0][0]["contexts"]["feedback"]
        == event["contexts"]["feedback"]
    )
    assert create_feedback_issue.call_args[0][0]["type"] == "feedback"
    assert create_feedback_issue.call_args[0][1] == project_id

    # preprocess_event is for error events only, make sure it wasn't called
    assert preprocess_event.call_count == 0
