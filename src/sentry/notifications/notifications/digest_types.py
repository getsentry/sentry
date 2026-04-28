from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel

from sentry.issues.issue_occurrence import IssueOccurrence, IssueOccurrenceData
from sentry.services.eventstore.models import Event, GroupEvent


class NotificationSerializedEvent(BaseModel):
    project_id: int
    group_id: int | None
    event_id: str
    datetime: datetime
    title: str
    culprit: str | None
    transaction: str | None
    platform: str | None
    message: str
    tags: list[tuple[str, str]]
    # Full event payload, materialized from NodeData. Needed for:
    # - ProjectOwnership.get_owners(project.id, event.data) — ownership matching
    # - get_interfaces(event.data) — email interface rendering
    # - get_replay_id() — contexts.replay.replay_id lookup
    # - get_event_type() / get_event_metadata() — derived below
    data: dict[str, Any]

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, NotificationSerializedEvent):
            return NotImplemented
        return self.event_id == other.event_id and self.group_id == other.group_id

    def __hash__(self) -> int:
        return hash((self.group_id, self.event_id))

    def get_tag(self, key: str) -> str | None:
        for t, v in self.tags:
            if t == key:
                return v
        return None

    def get_event_type(self) -> str:
        return str(self.data.get("type", "default"))

    def get_event_metadata(self) -> dict[str, Any]:
        return self.data.get("metadata") or {}

    @classmethod
    def from_event(cls, event: Event) -> NotificationSerializedEvent:
        return cls(
            project_id=event.project_id,
            group_id=event.group_id,
            event_id=event.event_id,
            datetime=event.datetime,
            title=event.title,
            culprit=event.culprit,
            transaction=event.transaction,
            platform=event.platform,
            message=event.message,
            tags=list(event.tags),
            data=dict(event.data.items()),
        )


class NotificationSerializedGroupEvent(NotificationSerializedEvent):
    _occurrence: IssueOccurrenceData | None

    @classmethod
    def from_group_event(cls, event: GroupEvent) -> NotificationSerializedGroupEvent:
        return cls(
            project_id=event.project_id,
            group_id=event.group_id,
            event_id=event.event_id,
            datetime=event.datetime,
            title=event.title,
            culprit=event.culprit,
            transaction=event.transaction,
            platform=event.platform,
            message=event.message,
            tags=list(event.tags),
            data=dict(event.data.items()),
            _occurrence=event.occurrence.to_dict() if event.occurrence else None,
        )

    @property
    def occurrence(self) -> IssueOccurrence | None:
        if self._occurrence is None:
            return None
        return IssueOccurrence.from_dict(self._occurrence)
