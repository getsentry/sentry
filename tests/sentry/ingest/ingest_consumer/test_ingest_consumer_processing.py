from __future__ import absolute_import

import uuid
import pytest
import time

from sentry.utils import json
from sentry.ingest.ingest_consumer import (
    process_event,
    process_attachment_chunk,
    process_individual_attachment,
    process_userreport,
)
from sentry.event_manager import EventManager
from sentry.models import EventAttachment, UserReport, EventUser


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
        "cache_key": u"e:{event_id}:{project_id}".format(event_id=event_id, project_id=project_id),
        "data": payload,
        "event_id": event_id,
        "project": default_project,
        "start_time": start_time,
    }


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
        assert attachment.file.type == "custom.attachment"
        assert attachment.file.headers == {"Content-Type": "text/plain"}
        file = attachment.file.getfile()
        assert file.read() == b"Hello World!"
        assert file.name == "lol.txt"
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
        assert attachment.file.type == "event.attachment"
        assert attachment.file.headers == {"Content-Type": "application/octet-stream"}
        assert attachment.group_id == group_id
        file = attachment.file.getfile()
        assert file.read() == b"".join(chunks)
        assert file.name == "foo.txt"


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

    attachments = list(
        EventAttachment.objects.filter(project_id=project_id, event_id=event_id).select_related(
            "file"
        )
    )

    assert not attachments
