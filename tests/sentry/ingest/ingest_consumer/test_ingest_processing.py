from __future__ import absolute_import

import pytest
import time

from sentry.utils import json
from sentry.ingest.ingest_consumer import process_event, process_attachment_chunk
from sentry.attachments import attachment_cache
from sentry.event_manager import EventManager


def get_normalized_event(data, project):
    mgr = EventManager(data, project=project)
    mgr.normalize()
    return dict(mgr.get_data())


@pytest.fixture
def preprocess_event(monkeypatch):
    calls = []

    def inner(**kwargs):
        calls.append(kwargs)

    monkeypatch.setattr("sentry.ingest.ingest_consumer.preprocess_event", inner)
    return calls


@pytest.mark.django_db
def test_deduplication_works(default_project, task_runner, monkeypatch, preprocess_event):
    payload = get_normalized_event({"message": "hello world"}, default_project)
    event_id = payload["event_id"]
    project_id = default_project.id
    start_time = time.time() - 3600

    for _ in range(2):
        process_event(
            {
                "payload": json.dumps(payload),
                "start_time": start_time,
                "event_id": event_id,
                "project_id": project_id,
                "remote_addr": "127.0.0.1",
            }
        )

    kwargs, = preprocess_event
    assert kwargs == {
        "cache_key": u"e:{event_id}:{project_id}".format(event_id=event_id, project_id=project_id),
        "data": payload,
        "event_id": event_id,
        "project": default_project,
        "start_time": start_time,
    }


@pytest.mark.django_db
def test_with_attachments(default_project, task_runner, monkeypatch, preprocess_event):
    payload = get_normalized_event({"message": "hello world"}, default_project)
    event_id = payload["event_id"]
    project_id = default_project.id
    start_time = time.time() - 3600

    process_attachment_chunk(
        {
            "payload": b"Hello ",
            "event_id": event_id,
            "project_id": project_id,
            "id": 0,
            "chunk_index": 0,
        }
    )

    process_attachment_chunk(
        {
            "payload": b"World!",
            "event_id": event_id,
            "project_id": project_id,
            "id": 0,
            "chunk_index": 1,
        }
    )

    process_event(
        {
            "payload": json.dumps(payload),
            "start_time": start_time,
            "event_id": event_id,
            "project_id": project_id,
            "remote_addr": "127.0.0.1",
            "attachments": [
                {
                    "id": 0,
                    "name": "lol.txt",
                    "content_type": "text/plain",
                    "attachment_type": "custom.attachment",
                    "chunks": 2,
                }
            ],
        }
    )

    kwargs, = preprocess_event
    cache_key = u"e:{event_id}:{project_id}".format(event_id=event_id, project_id=project_id)
    assert kwargs == {
        "cache_key": cache_key,
        "data": payload,
        "event_id": event_id,
        "project": default_project,
        "start_time": start_time,
    }

    att, = attachment_cache.get(cache_key)
    assert att.data == b"Hello World!"
    assert att.name == "lol.txt"
    assert att.content_type == "text/plain"
    assert att.type == "custom.attachment"
