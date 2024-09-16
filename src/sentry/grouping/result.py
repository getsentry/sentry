from dataclasses import dataclass
from typing import Optional

from sentry.db.models import NodeData


@dataclass(frozen=True)
class CalculatedHashes:
    hashes: list[str]

    def write_to_event(self, event_data: NodeData) -> None:
        event_data["hashes"] = self.hashes

    @classmethod
    def from_event(cls, event_data: NodeData) -> Optional["CalculatedHashes"]:
        hashes = event_data.get("hashes")
        if hashes is not None:
            return cls(hashes=hashes)

        return None
