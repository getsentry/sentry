import datetime
import time
import uuid
from unittest.mock import Mock

import pytest

from sentry.event_manager import EventManager
from sentry.ingest.ingest_consumer import (
    process_attachment_chunk,
    process_event,
    process_individual_attachment,
    process_userreport,
)
from sentry.models import EventAttachment, EventUser, File, Replay, UserReport
from sentry.utils import json


def get_normalized_event(data, project):
    mgr = EventManager(data, project=project)
    mgr.normalize()
    return dict(mgr.get_data())


@pytest.fixture
def save_event_transaction(monkeypatch):
    mock = Mock()
    monkeypatch.setattr("sentry.ingest.ingest_consumer.save_event_transaction", mock)
    return mock


@pytest.fixture
def preprocess_event(monkeypatch):
    calls = []

    def inner(**kwargs):
        calls.append(kwargs)

    monkeypatch.setattr("sentry.ingest.ingest_consumer.preprocess_event", inner)
    return calls


@pytest.mark.django_db
def test_deduplication_works(default_project, task_runner, preprocess_event):
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
            },
            projects={default_project.id: default_project},
        )

    (kwargs,) = preprocess_event
    assert kwargs == {
        "cache_key": f"e:{event_id}:{project_id}",
        "data": payload,
        "event_id": event_id,
        "project": default_project,
        "start_time": start_time,
    }


@pytest.mark.django_db
def test_transactions_spawn_save_event_transaction(
    default_project,
    task_runner,
    preprocess_event,
    save_event_transaction,
):
    project_id = default_project.id
    now = datetime.datetime.now()
    event = {
        "type": "transaction",
        "timestamp": now.isoformat(),
        "start_timestamp": now.isoformat(),
        "spans": [],
        "contexts": {
            "trace": {
                "parent_span_id": "8988cec7cc0779c1",
                "type": "trace",
                "op": "foobar",
                "trace_id": "a7d67cf796774551a95be6543cacd459",
                "span_id": "babaae0d4b7512d9",
                "status": "ok",
            }
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
        projects={default_project.id: default_project},
    )
    assert not len(preprocess_event)
    assert save_event_transaction.delay.call_args[0] == ()
    assert save_event_transaction.delay.call_args[1] == dict(
        cache_key=f"e:{event_id}:{project_id}",
        data=None,
        start_time=start_time,
        event_id=event_id,
        project_id=project_id,
    )


@pytest.mark.django_db
@pytest.mark.parametrize("missing_chunks", (True, False))
def test_with_attachments(default_project, task_runner, missing_chunks, monkeypatch):
    monkeypatch.setattr("sentry.features.has", lambda *a, **kw: True)

    payload = get_normalized_event({"message": "hello world"}, default_project)
    event_id = payload["event_id"]
    attachment_id = "ca90fb45-6dd9-40a0-a18f-8693aa621abb"
    project_id = default_project.id
    start_time = time.time() - 3600

    if not missing_chunks:
        process_attachment_chunk(
            {
                "payload": b"Hello ",
                "event_id": event_id,
                "project_id": project_id,
                "id": attachment_id,
                "chunk_index": 0,
            },
            projects={default_project.id: default_project},
        )

        process_attachment_chunk(
            {
                "payload": b"World!",
                "event_id": event_id,
                "project_id": project_id,
                "id": attachment_id,
                "chunk_index": 1,
            },
            projects={default_project.id: default_project},
        )

    with task_runner():
        process_event(
            {
                "payload": json.dumps(payload),
                "start_time": start_time,
                "event_id": event_id,
                "project_id": project_id,
                "remote_addr": "127.0.0.1",
                "attachments": [
                    {
                        "id": attachment_id,
                        "name": "lol.txt",
                        "content_type": "text/plain",
                        "attachment_type": "custom.attachment",
                        "chunks": 2,
                    }
                ],
            },
            projects={default_project.id: default_project},
        )

    persisted_attachments = list(
        EventAttachment.objects.filter(project_id=project_id, event_id=event_id)
    )

    if not missing_chunks:
        (attachment,) = persisted_attachments
        file = File.objects.get(id=attachment.file_id)
        assert file.type == "custom.attachment"
        assert file.headers == {"Content-Type": "text/plain"}
        file_contents = file.getfile()
        assert file_contents.read() == b"Hello World!"
        assert file_contents.name == "lol.txt"
    else:
        assert not persisted_attachments


@pytest.mark.django_db
@pytest.mark.parametrize(
    "event_attachments", [True, False], ids=["with_feature", "without_feature"]
)
@pytest.mark.parametrize(
    "chunks", [(b"Hello ", b"World!"), (b"",), ()], ids=["basic", "zerolen", "nochunks"]
)
@pytest.mark.parametrize("with_group", [True, False], ids=["with_group", "without_group"])
def test_individual_attachments(
    default_project, factories, monkeypatch, event_attachments, chunks, with_group
):
    monkeypatch.setattr("sentry.features.has", lambda *a, **kw: event_attachments)

    event_id = "515539018c9b4260a6f999572f1661ee"
    attachment_id = "ca90fb45-6dd9-40a0-a18f-8693aa621abb"
    project_id = default_project.id
    group_id = None

    if with_group:
        event = factories.store_event(
            data={"event_id": event_id, "message": "existence is pain"}, project_id=project_id
        )

        group_id = event.group.id
        assert group_id, "this test requires a group to work"

    for i, chunk in enumerate(chunks):
        process_attachment_chunk(
            {
                "payload": chunk,
                "event_id": event_id,
                "project_id": project_id,
                "id": attachment_id,
                "chunk_index": i,
            },
            projects={default_project.id: default_project},
        )

    process_individual_attachment(
        {
            "type": "attachment",
            "attachment": {
                "attachment_type": "event.attachment",
                "chunks": len(chunks),
                "content_type": "application/octet-stream",
                "id": attachment_id,
                "name": "foo.txt",
            },
            "event_id": event_id,
            "project_id": project_id,
        },
        projects={default_project.id: default_project},
    )

    attachments = list(EventAttachment.objects.filter(project_id=project_id, event_id=event_id))

    if not event_attachments:
        assert not attachments
    else:
        (attachment,) = attachments
        file = File.objects.get(id=attachment.file_id)
        assert file.type == "event.attachment"
        assert file.headers == {"Content-Type": "application/octet-stream"}
        assert attachment.group_id == group_id
        file_contents = file.getfile()
        assert file_contents.read() == b"".join(chunks)
        assert file_contents.name == "foo.txt"


@pytest.mark.django_db
def test_replay_attachment(default_project, factories, monkeypatch):
    monkeypatch.setattr("sentry.features.has", lambda *a, **kw: True)

    chunks = (
        b'{"events":[{"type":4,"data":{"href":"http://localhost:3000/","width":1165,"height":1336},"timestamp":1643848997798}]}',
    )
    event_id = "515539018c9b4260a6f999572f1661ee"
    attachment_id = "ca90fb45-6dd9-40a0-a18f-8693aa621abb"
    project_id = default_project.id
    group_id = None

    for i, chunk in enumerate(chunks):
        process_attachment_chunk(
            {
                "payload": chunk,
                "event_id": event_id,
                "project_id": project_id,
                "id": attachment_id,
                "chunk_index": i,
            },
            projects={default_project.id: default_project},
        )

    process_individual_attachment(
        {
            "type": "attachment",
            "attachment": {
                "attachment_type": "event.attachment",
                "chunks": len(chunks),
                "content_type": "application/json",
                "id": attachment_id,
                "name": "rrweb.json",
            },
            "event_id": event_id,
            "project_id": project_id,
        },
        projects={default_project.id: default_project},
    )

    attachments = list(EventAttachment.objects.filter(project_id=project_id, event_id=event_id))

    (attachment,) = attachments
    file = File.objects.get(id=attachment.file_id)
    assert file.type == "event.attachment"
    assert file.headers == {"Content-Type": "application/json"}
    assert attachment.group_id == group_id
    file_contents = file.getfile()
    assert file_contents.read() == b"".join(chunks)
    assert file_contents.name == "rrweb.json"

    replays = list(Replay.objects.filter(project_id=project_id, event_id=event_id))
    assert len(replays) == 1


@pytest.mark.django_db
def test_userreport(default_project, monkeypatch):
    """
    Test that user_report-type kafka messages end up in a user report being
    persisted. We additionally test some logic around upserting data in
    eventuser which is also present in the legacy endpoint.
    """
    event_id = uuid.uuid4().hex
    start_time = time.time() - 3600

    mgr = EventManager(data={"event_id": event_id, "user": {"email": "markus+dontatme@sentry.io"}})

    mgr.normalize()
    mgr.save(default_project.id)

    (evtuser,) = EventUser.objects.all()
    assert not evtuser.name

    assert not UserReport.objects.all()

    assert process_userreport(
        {
            "type": "user_report",
            "start_time": start_time,
            "payload": json.dumps(
                {
                    "name": "Hans Gans",
                    "event_id": event_id,
                    "comments": "hello world",
                    "email": "markus+dontatme@sentry.io",
                }
            ),
            "project_id": default_project.id,
        },
        projects={default_project.id: default_project},
    )

    (report,) = UserReport.objects.all()
    assert report.comments == "hello world"

    (evtuser,) = EventUser.objects.all()
    assert evtuser.name == "Hans Gans"


@pytest.mark.django_db
def test_userreport_reverse_order(default_project, monkeypatch):
    """
    Test that ingesting a userreport before the event works. This is relevant
    for unreal crashes where the userreport is processed immediately in the
    ingest consumer while the rest of the event goes to processing tasks.
    """
    event_id = uuid.uuid4().hex
    start_time = time.time() - 3600

    assert process_userreport(
        {
            "type": "user_report",
            "start_time": start_time,
            "payload": json.dumps(
                {
                    "name": "Hans Gans",
                    "event_id": event_id,
                    "comments": "hello world",
                    "email": "markus+dontatme@sentry.io",
                }
            ),
            "project_id": default_project.id,
        },
        projects={default_project.id: default_project},
    )

    mgr = EventManager(data={"event_id": event_id, "user": {"email": "markus+dontatme@sentry.io"}})

    mgr.normalize()
    mgr.save(default_project.id)

    (report,) = UserReport.objects.all()
    assert report.comments == "hello world"

    (evtuser,) = EventUser.objects.all()
    # Event got saved after user report, and the sync only works in the
    # opposite direction. That's fine, we just accept it.
    assert evtuser.name is None


@pytest.mark.django_db
def test_individual_attachments_missing_chunks(default_project, factories, monkeypatch):
    monkeypatch.setattr("sentry.features.has", lambda *a, **kw: True)

    event_id = "515539018c9b4260a6f999572f1661ee"
    attachment_id = "ca90fb45-6dd9-40a0-a18f-8693aa621abb"
    project_id = default_project.id

    process_individual_attachment(
        {
            "type": "attachment",
            "attachment": {
                "attachment_type": "event.attachment",
                "chunks": 123,
                "content_type": "application/octet-stream",
                "id": attachment_id,
                "name": "foo.txt",
            },
            "event_id": event_id,
            "project_id": project_id,
        },
        projects={default_project.id: default_project},
    )

    attachments = list(EventAttachment.objects.filter(project_id=project_id, event_id=event_id))

    assert not attachments
