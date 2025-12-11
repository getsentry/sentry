from collections.abc import Iterator
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sentry.issues.grouptype import SizeBadType
from sentry.issues.issue_occurrence import IssueOccurrence


class SizeIssueOccurrenceBuilder:
    def __init__(self):
        self.issue_title = None
        self.project_id = None

    def build(self) -> tuple[IssueOccurrence, dict[str, Any]]:
        id = uuid4()
        assert self.issue_title is not None, "issue_title must be set"
        assert self.project_id is not None, "project_id must be set"

        current_timestamp = datetime.now(timezone.utc)
        id = uuid4().hex
        event_id = uuid4().hex

        event_data = {
            "event_id": event_id,
            "platform": "other",
            "project_id": self.project_id,
            "received": current_timestamp.isoformat(),
            "sdk": None,
            "tags": {},
            "timestamp": current_timestamp.isoformat(),
            # "contexts": {"monitor": get_monitor_environment_context(monitor_env)},
            "environment": "prod",
            # "fingerprint": [incident.grouphash],
        }

        return (
            IssueOccurrence(
                id=id,
                event_id=event_id,
                issue_title=self.issue_title,
                subtitle="",
                project_id=self.project_id,
                # TODO: fix
                fingerprint=uuid4().hex,
                type=SizeBadType,
                # Now?
                detection_time=current_timestamp,
                level="error",
                resource_id="",
                evidence_data={},
                evidence_display={},
                culprit="",
            ),
            event_data,
        )


def insight_to_occurrences(name: str, insight: dict[str, any]) -> list[SizeIssueOccurrenceBuilder]:
    print(f"??? insight_to_occurrences {name}")
    builder = SizeIssueOccurrenceBuilder()
    builder.issue_title = f"Bad size {name}"
    return [builder]
