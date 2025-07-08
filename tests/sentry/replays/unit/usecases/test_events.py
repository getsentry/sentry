import time

from sentry.replays.usecases.events import archive_event, viewed_event
from sentry.utils import json


def test_archive_event():
    """Test archive event generator."""
    event = archive_event(1, "2")

    parsed_event = json.loads(event)
    assert parsed_event["type"] == "replay_event"
    assert isinstance(parsed_event["start_time"], int)
    assert parsed_event["project_id"] == 1
    assert parsed_event["replay_id"] == "2"
    assert parsed_event["retention_days"] == 90
    assert parsed_event["payload"]["type"] == "replay_event"
    assert parsed_event["payload"]["replay_id"] == "2"
    assert len(parsed_event["payload"]["event_id"]) == 32
    assert parsed_event["payload"]["segment_id"] is None
    assert parsed_event["payload"]["trace_ids"] == []
    assert parsed_event["payload"]["error_ids"] == []
    assert parsed_event["payload"]["urls"] == []
    assert parsed_event["payload"]["is_archived"] is True
    assert parsed_event["payload"]["platform"] == ""
    assert isinstance(parsed_event["payload"]["timestamp"], float)


def test_viewed_event():
    """Test "replay_viewed" event generator."""
    ts = time.time()
    event = viewed_event(1, "2", 3, ts)

    parsed_event = json.loads(event)
    assert parsed_event["type"] == "replay_event"
    assert isinstance(parsed_event["start_time"], int)
    assert parsed_event["project_id"] == 1
    assert parsed_event["replay_id"] == "2"
    assert parsed_event["retention_days"] == 90
    assert parsed_event["payload"]["type"] == "replay_viewed"
    assert parsed_event["payload"]["viewed_by_id"] == 3
    assert parsed_event["payload"]["timestamp"] == ts
