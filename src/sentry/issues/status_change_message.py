from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, NotRequired, TypedDict, int
from uuid import uuid4


class StatusChangeMessageData(TypedDict):
    fingerprint: Sequence[str]
    project_id: int
    new_status: int
    new_substatus: int | None
    id: str
    detector_id: int | None
    activity_data: dict[str, Any] | None
    update_date: NotRequired[datetime | None]


@dataclass(frozen=True)
class StatusChangeMessage:
    fingerprint: Sequence[str]
    project_id: int
    new_status: int
    new_substatus: int | None
    detector_id: int | None = None
    activity_data: dict[str, Any] | None = None
    update_date: datetime | None = None
    id: str = field(default_factory=lambda: uuid4().hex)

    def to_dict(
        self,
    ) -> StatusChangeMessageData:
        return {
            "fingerprint": self.fingerprint,
            "project_id": self.project_id,
            "new_status": self.new_status,
            "new_substatus": self.new_substatus,
            "detector_id": self.detector_id,
            "activity_data": self.activity_data,
            "update_date": self.update_date,
            "id": self.id,
        }
