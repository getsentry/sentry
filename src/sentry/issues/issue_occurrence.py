from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Mapping, Optional, Sequence

from dateutil.parser import parse as parse_date

from sentry import nodestore
from sentry.types.issues import GroupType
from sentry.utils.dates import ensure_aware


@dataclass(frozen=True)
class IssueEvidence:
    name: str
    value: str
    important: bool

    def to_dict(
        self,
    ) -> Mapping[str, Any]:
        return {
            "name": self.name,
            "value": self.value,
            "important": self.important,
        }


@dataclass(frozen=True)
class IssueOccurrence:
    """
    A class representing a specific occurrence of an issue. Separate to an `Event`. An `Event` may
    have 0-M `IssueOccurrences` associated with it, and each `IssueOccurrence` is associated with
    one `Event`.

    Longer term, we might change this relationship so that each `IssueOccurrence` is the primary
    piece of data that is passed around. It would have an `Event` associated with it.
    """

    id: str
    # Event id pointing to an event in nodestore
    event_id: str
    fingerprint: Sequence[str]
    issue_title: str
    # Exact format not decided yet, but this will be a string regardless
    subtitle: str
    resource_id: str | None
    # Extra context around how the problem was detected. Used to display grouping information on
    # the issue details page, and will be available for use in UI customizations.
    evidence_data: Mapping[str, Any]
    # Extra context around the problem that will be displayed as a default in the UI and alerts.
    # This should be human-readable. One of these entries should be marked as `important` for use
    # in more space restricted integrations.
    evidence_display: Sequence[IssueEvidence]
    type: GroupType
    detection_time: datetime

    def __post_init__(self) -> None:
        object.__setattr__(self, "detection_time", ensure_aware(self.detection_time))

    def to_dict(
        self,
    ) -> Mapping[str, Any]:
        return {
            "id": self.id,
            "event_id": self.event_id,
            "fingerprint": self.fingerprint,
            "issue_title": self.issue_title,
            "subtitle": self.subtitle,
            "resource_id": self.resource_id,
            "evidence_data": self.evidence_data,
            "evidence_display": [evidence.to_dict() for evidence in self.evidence_display],
            "type": self.type.value,
            "detection_time": self.detection_time.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> IssueOccurrence:
        return cls(
            data["id"],
            data["event_id"],
            data["fingerprint"],
            data["issue_title"],
            data["subtitle"],
            data["resource_id"],
            data["evidence_data"],
            [
                IssueEvidence(evidence["name"], evidence["value"], evidence["important"])
                for evidence in data["evidence_display"]
            ],
            GroupType(data["type"]),
            parse_date(data["detection_time"]),
        )

    def __eq__(self, other: Any) -> bool:
        if not isinstance(other, IssueOccurrence):
            return NotImplemented
        return self.id == other.id

    def __hash__(self) -> int:
        return hash(self.id)

    def save(self) -> None:
        nodestore.set(self.id, self.to_dict())

    @classmethod
    def fetch(cls, id: str) -> Optional[IssueOccurrence]:
        results = nodestore.get(id)
        if results:
            return IssueOccurrence.from_dict(results)
        return None
