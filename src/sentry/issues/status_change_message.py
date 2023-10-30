from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence, TypedDict


class StatusChangeMessageData(TypedDict):
    fingerprint: Sequence[str]
    project_id: int
    new_status: int
    new_substatus: int | None


@dataclass(frozen=True)
class StatusChangeMessage:
    fingerprint: Sequence[str]
    project_id: int
    new_status: int
    new_substatus: int | None

    def to_dict(
        self,
    ) -> StatusChangeMessageData:
        return {
            "fingerprint": self.fingerprint,
            "project_id": self.project_id,
            "new_status": self.new_status,
            "new_substatus": self.new_substatus,
        }
