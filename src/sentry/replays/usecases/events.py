from __future__ import annotations

import time
import uuid
from typing import Any

from sentry.replays.lib.kafka import initialize_replays_publisher
from sentry.utils import json


def archive_event(project_id: int, replay_id: str) -> str:
    """Create an archive "replay_event" message."""
    return _replay_event(
        project_id=project_id,
        replay_id=replay_id,
        event={
            "type": "replay_event",
            "replay_id": replay_id,
            "event_id": uuid.uuid4().hex,
            "segment_id": None,
            "trace_ids": [],
            "error_ids": [],
            "urls": [],
            "timestamp": time.time(),
            "is_archived": True,
            "platform": "",
        },
    )


def viewed_event(project_id: int, replay_id: str, viewed_by_id: int, timestamp: float) -> str:
    """Create a "replay_viewed" message."""
    return _replay_event(
        project_id=project_id,
        replay_id=replay_id,
        event={
            "type": "replay_viewed",
            "timestamp": timestamp,
            "viewed_by_id": viewed_by_id,
        },
    )


def ai_score_event(
    project_id: int,
    replay_id: str,
    score_type: str,
    score: int,
    timestamp: float,
) -> str:
    """Create a "ai_score" message."""
    return _replay_event(
        project_id=project_id,
        replay_id=replay_id,
        event={
            "type": "ai_score",
            "score_type": score_type,
            "timestamp": timestamp,
            "score": score,
        },
    )


def ai_summary_event(project_id: int, replay_id: str, summary: str, timestamp: float) -> str:
    """Create a "ai_score" message."""
    return _replay_event(
        project_id=project_id,
        replay_id=replay_id,
        event={
            "type": "ai_summary",
            "timestamp": timestamp,
            "summary": summary,
        },
    )


def _replay_event(project_id: int, replay_id: str, event: dict[str, Any]) -> str:
    return json.dumps(
        {
            "type": "replay_event",
            "start_time": int(time.time()),
            "replay_id": replay_id,
            "project_id": project_id,
            "segment_id": None,
            "retention_days": 90,
            "payload": list(json.dumps(event).encode()),
        }
    )


def publish_replay_event(message: str, is_async: bool):
    """Publish a replay-event to the replay snuba consumer topic."""
    publisher = initialize_replays_publisher(is_async=is_async)
    publisher.publish("ingest-replay-events", message)
