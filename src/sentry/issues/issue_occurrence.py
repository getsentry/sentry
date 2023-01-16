from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Mapping, Optional, Sequence, TypedDict, cast

from django.utils.timezone import is_aware

from sentry import nodestore
from sentry.types.issues import GroupType
from sentry.utils.dates import parse_timestamp


class IssueEvidenceData(TypedDict):
    name: str
    value: str
    important: bool


class IssueOccurrenceData(TypedDict):
    id: str
    event_id: str
    fingerprint: Sequence[str]
    issue_title: str
    subtitle: str
    resource_id: str | None
    evidence_data: Mapping[str, Any]
    evidence_display: Sequence[IssueEvidenceData]
    type: int
    detection_time: float
    level: Optional[str]


@dataclass(frozen=True)
class IssueEvidence:
    name: str
    value: str
    # Whether to prioritise displaying this evidence to users over other issue evidence. Should
    # only be one important row per occurrence.
    important: bool

    def to_dict(
        self,
    ) -> IssueEvidenceData:
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
    level: Optional[str] = None

    def __post_init__(self) -> None:
        if not is_aware(self.detection_time):
            raise ValueError("detection_time must be timezone aware")

    def to_dict(
        self,
    ) -> IssueOccurrenceData:
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
            "detection_time": self.detection_time.timestamp(),
            "level": self.level,
        }

    @classmethod
    def from_dict(cls, data: IssueOccurrenceData) -> IssueOccurrence:
        return cls(
            data["id"],
            # We'll always have an event id when loading an issue occurrence
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
            cast(datetime, parse_timestamp(data["detection_time"])),
            data.get("level"),
        )

    @property
    def important_evidence_display(self) -> Optional[IssueEvidence]:
        """
        Returns the most important piece of evidence for display in space constrained integrations.
        If multiple pieces of evidence are marked as important, returns the first one seen.
        """
        for evidence in self.evidence_display:
            if evidence.important:
                return evidence
        return None

    def __eq__(self, other: Any) -> bool:
        if not isinstance(other, IssueOccurrence):
            return NotImplemented
        return self.id == other.id

    def __hash__(self) -> int:
        return hash(self.id)

    @classmethod
    def build_storage_identifier(cls, id_: str, project_id: int) -> str:
        identifier = hashlib.md5(f"{id_}::{project_id}".encode()).hexdigest()
        return f"i-o:{identifier}"

    def save(self, project_id: int) -> None:
        nodestore.set(self.build_storage_identifier(self.id, project_id), self.to_dict())

    @classmethod
    def fetch(cls, id_: str, project_id: int) -> Optional[IssueOccurrence]:
        results = nodestore.get(cls.build_storage_identifier(id_, project_id))
        if results:
            return IssueOccurrence.from_dict(results)
        return None
