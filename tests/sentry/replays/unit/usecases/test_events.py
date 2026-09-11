import time
from datetime import datetime, timezone

from sentry.replays.usecases.events import archive_event, viewed_event
from sentry.utils import json


def test_archive_event() -> None:
    """Test archive event generator."""
    # An old timestamp: the archive row has to land in the replay's own date range, not today's.
    ts = datetime(2023, 6, 21, tzinfo=timezone.utc)
    event = archive_event(1, "2", ts)

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
    assert parsed_event["payload"]["timestamp"] == ts.timestamp()
    # "now" belongs to the envelope, which only feeds consumer latency metrics.
    assert parsed_event["start_time"] != int(ts.timestamp())


def test_viewed_event() -> None:
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
