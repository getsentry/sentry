from __future__ import annotations

import datetime
import time
import uuid
import zipfile
from io import BytesIO
from typing import Any
from unittest.mock import Mock

import pytest
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.backends.local.backend import LocalBroker
from arroyo.backends.local.storages.memory import MemoryMessageStorage
from arroyo.types import Partition, Topic
from django.conf import settings

from sentry.event_manager import EventManager
from sentry.ingest.consumer.processors import (
    process_attachment_chunk,
    process_event,
    process_individual_attachment,
    process_userreport,
)
from sentry.models.debugfile import create_files_from_dif_zip
from sentry.models.eventattachment import EventAttachment
from sentry.models.eventuser import EventUser
from sentry.models.files.file import File
from sentry.models.userreport import UserReport
from sentry.options import set
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.skips import requires_snuba
from sentry.usage_accountant import accountant
from sentry.utils import json
from sentry.utils.json import loads

pytestmark = [requires_snuba]

PROGUARD_UUID = "467ade76-6d0b-11ed-a1eb-0242ac120002"
PROGUARD_SOURCE = b"""\
org.slf4j.helpers.Util$ClassContextSecurityManager -> org.a.b.g$a:
    65:65:void <init>() -> <init>
    67:67:java.lang.Class[] getClassContext() -> a
    69:69:java.lang.Class[] getExtraClassContext() -> a
    65:65:void <init>(org.slf4j.helpers.Util$1) -> <init>
"""


def get_normalized_event(data, project):
    mgr = EventManager(data, project=project)
    mgr.normalize()
    return dict(mgr.get_data())


@pytest.fixture
def save_event_transaction(monkeypatch):
    mock = Mock()
    monkeypatch.setattr("sentry.ingest.consumer.processors.save_event_transaction", mock)
    return mock


@pytest.fixture
def save_event_feedback(monkeypatch):
    mock = Mock()
    monkeypatch.setattr("sentry.ingest.consumer.processors.save_event_feedback", mock)
    return mock


@pytest.fixture
def preprocess_event(monkeypatch):
    calls = []

    def inner(**kwargs):
        calls.append(kwargs)

    monkeypatch.setattr("sentry.ingest.consumer.processors.preprocess_event", inner)
    return calls


@django_db_all
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
            project=default_project,
        )

    (kwargs,) = preprocess_event
    assert kwargs == {
        "cache_key": f"e:{event_id}:{project_id}",
        "data": payload,
        "event_id": event_id,
        "project": default_project,
        "start_time": start_time,
        "has_attachments": False,
    }


@django_db_all
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
        project=default_project,
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


@django_db_all
def test_accountant_transaction(default_project):
    storage: MemoryMessageStorage[KafkaPayload] = MemoryMessageStorage()
    broker = LocalBroker(storage)
    topic = Topic("shared-resources-usage")
    broker.create_topic(topic, 1)
    producer = broker.get_producer()

    set("shared_resources_accounting_enabled", [settings.EVENT_PROCESSING_STORE])

    accountant.init_backend(producer)

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
    serialized = json.dumps(payload)
    process_event(
        {
            "payload": serialized,
            "start_time": time.time() - 3600,
            "event_id": payload["event_id"],
            "project_id": default_project.id,
            "remote_addr": "127.0.0.1",
        },
        project=default_project,
    )

    accountant._shutdown()
    msg1 = broker.consume(Partition(topic, 0), 0)
    assert msg1 is not None
    payload = msg1.payload
    assert payload is not None
    formatted = loads(payload.value.decode("utf-8"))
    assert formatted["shared_resource_id"] == settings.EVENT_PROCESSING_STORE
    assert formatted["app_feature"] == "transactions"
    assert formatted["usage_unit"] == "bytes"
    assert formatted["amount"] == len(serialized)


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
    assert not len(preprocess_event)
    assert save_event_feedback.delay.call_args[0] == ()
    assert (
        save_event_feedback.delay.call_args[1]["data"]["contexts"]["feedback"]
        == event["contexts"]["feedback"]
    )
    assert save_event_feedback.delay.call_args[1]["data"]["type"] == "feedback"


@django_db_all
@pytest.mark.parametrize("missing_chunks", (True, False))
def test_with_attachments(default_project, task_runner, missing_chunks, monkeypatch, django_cache):
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
            }
        )

        process_attachment_chunk(
            {
                "payload": b"World!",
                "event_id": event_id,
                "project_id": project_id,
                "id": attachment_id,
                "chunk_index": 1,
            }
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
            project=default_project,
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


@django_db_all
def test_deobfuscate_view_hierarchy(default_project, task_runner):
    payload = get_normalized_event(
        {
            "message": "hello world",
            "debug_meta": {"images": [{"uuid": PROGUARD_UUID, "type": "proguard"}]},
        },
        default_project,
    )
    event_id = payload["event_id"]
    attachment_id = "ca90fb45-6dd9-40a0-a18f-8693aa621abb"
    project_id = default_project.id
    start_time = time.time() - 3600

    # Create the proguard file
    with zipfile.ZipFile(BytesIO(), "w") as f:
        f.writestr(f"proguard/{PROGUARD_UUID}.txt", PROGUARD_SOURCE)
        create_files_from_dif_zip(f, project=default_project)

    expected_response = b'{"rendering_system":"Test System","windows":[{"identifier":"parent","type":"org.slf4j.helpers.Util$ClassContextSecurityManager","children":[{"identifier":"child","type":"org.slf4j.helpers.Util$ClassContextSecurityManager"}]}]}'
    obfuscated_view_hierarchy = {
        "rendering_system": "Test System",
        "windows": [
            {
                "identifier": "parent",
                "type": "org.a.b.g$a",
                "children": [
                    {
                        "identifier": "child",
                        "type": "org.a.b.g$a",
                    }
                ],
            }
        ],
    }

    process_attachment_chunk(
        {
            "payload": json.dumps_htmlsafe(obfuscated_view_hierarchy).encode(),
            "event_id": event_id,
            "project_id": project_id,
            "id": attachment_id,
            "chunk_index": 0,
        }
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
                        "name": "view_hierarchy.json",
                        "content_type": "application/json",
                        "attachment_type": "event.view_hierarchy",
                        "chunks": 1,
                    }
                ],
            },
            project=default_project,
        )

    persisted_attachments = list(
        EventAttachment.objects.filter(project_id=project_id, event_id=event_id)
    )
    (attachment,) = persisted_attachments
    file = File.objects.get(id=attachment.file_id)
    assert file.type == "event.view_hierarchy"
    assert file.headers == {"Content-Type": "application/json"}
    file_contents = file.getfile()
    assert file_contents.read() == expected_response
    assert file_contents.name == "view_hierarchy.json"


@django_db_all
@pytest.mark.parametrize(
    "event_attachments", [True, False], ids=["with_feature", "without_feature"]
)
@pytest.mark.parametrize(
    "chunks",
    [
        ((b"Hello ", b"World!"), "event.attachment", "application/octet-stream"),
        ((b"",), "event.attachment", "application/octet-stream"),
        ((), "event.attachment", "application/octet-stream"),
        (
            (b'{"rendering_system":"flutter","windows":[]}',),
            "event.view_hierarchy",
            "application/json",
        ),
    ],
    ids=["basic", "zerolen", "nochunks", "view_hierarchy"],
)
@pytest.mark.parametrize("with_group", [True, False], ids=["with_group", "without_group"])
def test_individual_attachments(
    default_project, factories, monkeypatch, event_attachments, chunks, with_group, django_cache
):
    monkeypatch.setattr("sentry.features.has", lambda *a, **kw: event_attachments)

    event_id = uuid.uuid4().hex
    attachment_id = "ca90fb45-6dd9-40a0-a18f-8693aa621abb"
    project_id = default_project.id
    group_id = None

    if with_group:
        event = factories.store_event(
            data={"event_id": event_id, "message": "existence is pain"}, project_id=project_id
        )

        group_id = event.group.id
        assert group_id, "this test requires a group to work"

    for i, chunk in enumerate(chunks[0]):
        process_attachment_chunk(
            {
                "payload": chunk,
                "event_id": event_id,
                "project_id": project_id,
                "id": attachment_id,
                "chunk_index": i,
            }
        )

    process_individual_attachment(
        {
            "type": "attachment",
            "attachment": {
                "attachment_type": chunks[1],
                "chunks": len(chunks[0]),
                "content_type": chunks[2],
                "id": attachment_id,
                "name": "foo.txt",
            },
            "event_id": event_id,
            "project_id": project_id,
        },
        project=default_project,
    )

    attachments = list(EventAttachment.objects.filter(project_id=project_id, event_id=event_id))

    if not event_attachments:
        assert not attachments
    else:
        (attachment,) = attachments
        file = File.objects.get(id=attachment.file_id)
        assert file.type == chunks[1]
        assert file.headers == {"Content-Type": chunks[2]}
        assert attachment.group_id == group_id
        file_contents = file.getfile()
        assert file_contents.read() == b"".join(chunks[0])
        assert file_contents.name == "foo.txt"


@django_db_all
def test_userreport(django_cache, default_project, monkeypatch):
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
        project=default_project,
    )

    (report,) = UserReport.objects.all()
    assert report.comments == "hello world"


@django_db_all
def test_userreport_reverse_order(django_cache, default_project, monkeypatch):
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
        project=default_project,
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


@django_db_all
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
        project=default_project,
    )

    attachments = list(EventAttachment.objects.filter(project_id=project_id, event_id=event_id))

    assert not attachments
