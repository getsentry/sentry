from __future__ import annotations

import time
import uuid
from datetime import datetime
from typing import Any

from sentry.utils import json


def archive_event(project_id: int, replay_id: str, timestamp: datetime) -> str:
    """Create an archive "replay_event" message.

    `timestamp` decides which day the archive row lands in. Replay queries always carry a timestamp
    window and aggregate `is_archived` per replay within it, so an archive row stamped "now" is
    invisible to anyone looking at the deleted replay's own date range. Pass the replay's own
    timestamp whenever the caller knows it.
    """
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
            "timestamp": timestamp.timestamp(),
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


def _replay_event(project_id: int, replay_id: str, event: dict[str, Any]) -> str:
    return json.dumps(
        {
            "type": "replay_event",
            "start_time": int(time.time()),
            "replay_id": replay_id,
            "project_id": project_id,
            "segment_id": None,
            "retention_days": 90,
            "payload": event,
        }
    )
