import pytest

from sentry import replaystore
from sentry.replays.consumers import process_individual_replay_payload, process_replay_chunk

from ..fixtures import *  # NOQA

# TODO: test for flush_batch logic


@pytest.mark.django_db
@pytest.mark.parametrize(
    "chunks", [(b"Hello ", b"World!"), (b"",), ()], ids=["basic", "zerolen", "nochunks"]
)
def test_individual_replay_payloads(default_project, factories, chunks):
    event_id = "515539018c9b4260a6f999572f1661ee"
    attachment_id = "ca90fb45-6dd9-40a0-a18f-8693aa621abb"
    project_id = default_project.id

    for i, chunk in enumerate(chunks):
        process_replay_chunk(
            {
                "payload": chunk,
                "event_id": event_id,
                "project_id": project_id,
                "id": attachment_id,
                "chunk_index": i,
            }
        )

    process_individual_replay_payload(
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
        }
    )

    replay = replaystore.get_replay(event_id)
    assert replay.payloads


@pytest.mark.django_db
def test_individual_replay_payloads_missing_chunks(default_project, factories, monkeypatch):
    event_id = "515539018c9b4260a6f999572f1661ee"
    attachment_id = "ca90fb45-6dd9-40a0-a18f-8693aa621abb"
    project_id = default_project.id

    process_individual_replay_payload(
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
        }
    )

    replay = replaystore.get_replay(event_id)
    assert not replay
