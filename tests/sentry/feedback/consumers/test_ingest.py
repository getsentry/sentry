from __future__ import annotations

import datetime
import time
from typing import Any
from unittest.mock import Mock

import pytest

from sentry.event_manager import EventManager
from sentry.ingest.consumer.processors import process_event
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.skips import requires_snuba
from sentry.utils import json

pytestmark = [requires_snuba]


def get_normalized_event(data, project):
    # Based on test_ingest_consumer_processing.py
    mgr = EventManager(data, project=project)
    mgr.normalize()
    return dict(mgr.get_data())


@pytest.fixture
def save_event_feedback(monkeypatch):
    mock = Mock()
    monkeypatch.setattr("sentry.ingest.consumer.processors.save_event_feedback", mock)
    return mock


@pytest.fixture
def preprocess_event(monkeypatch):
    # Based on test_ingest_consumer_processing.py
    calls = []

    def inner(**kwargs):
        calls.append(kwargs)

    monkeypatch.setattr("sentry.ingest.consumer.processors.preprocess_event", inner)
    return calls


@django_db_all
def test_feedbacks_spawn_save_event_feedback(
    default_project, task_runner, preprocess_event, save_event_feedback, monkeypatch
):
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
    assert not preprocess_event
    assert save_event_feedback.delay.call_args[0] == ()
    assert (
        save_event_feedback.delay.call_args[1]["data"]["contexts"]["feedback"]
        == event["contexts"]["feedback"]
    )
    assert save_event_feedback.delay.call_args[1]["data"]["type"] == "feedback"
