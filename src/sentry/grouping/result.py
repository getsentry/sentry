from dataclasses import dataclass, field
from typing import Optional

from sentry.db.models import NodeData
from sentry.grouping.variants import BaseVariant


@dataclass(frozen=True)
class CalculatedHashes:
    hashes: list[str]
    # `variants` will never be `None` when the `CalculatedHashes` instance is created as part of
    # event grouping, but it has to be typed including `None` because we use the `CalculatedHashes`
    # container in other places where we don't have the variants data
    variants: dict[str, BaseVariant] = field(default_factory=dict)

    def write_to_event(self, event_data: NodeData) -> None:
        event_data["hashes"] = self.hashes

    @classmethod
    def from_event(cls, event_data: NodeData) -> Optional["CalculatedHashes"]:
        hashes = event_data.get("hashes")
        if hashes is not None:
            return cls(hashes=hashes)

        return None
