from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import TypedDict
from uuid import uuid4


class StatusChangeMessageData(TypedDict):
    fingerprint: Sequence[str]
    project_id: int
    new_status: int
    new_substatus: int | None
    id: str


@dataclass(frozen=True)
class StatusChangeMessage:
    fingerprint: Sequence[str]
    project_id: int
    new_status: int
    new_substatus: int | None
    id: str = field(default_factory=lambda: uuid4().hex)

    def to_dict(
        self,
    ) -> StatusChangeMessageData:
        return {
            "fingerprint": self.fingerprint,
            "project_id": self.project_id,
            "new_status": self.new_status,
            "new_substatus": self.new_substatus,
            "id": self.id,
        }
