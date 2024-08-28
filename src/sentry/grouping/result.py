from dataclasses import dataclass, field
from typing import Any, Optional

from sentry.db.models import NodeData
from sentry.grouping.variants import BaseVariant

EventMetadata = dict[str, Any]


@dataclass(frozen=True)
class CalculatedHashes:
    hashes: list[str]
    hierarchical_hashes: list[str] = field(default_factory=list)
    # `variants` will never be `None` when the `CalculatedHashes` instance is created as part of
    # event grouping, but it has to be typed including `None` because we use the `CalculatedHashes`
    # container in other places where we don't have the variants data
    #
    # TODO: Once we get rid of hierarchical hashing, those other places will just be using
    # `CalculatedHashes` to wrap `hashes` - meaning we don't need a wrapper at all, and can save use
    # of `CalculatedHashes` for times when we know the variants are there (so we can make them
    # required in the type)
    variants: dict[str, BaseVariant] = field(default_factory=dict)

    def write_to_event(self, event_data: NodeData) -> None:
        event_data["hashes"] = self.hashes

        if self.hierarchical_hashes:
            event_data["hierarchical_hashes"] = self.hierarchical_hashes

    @classmethod
    def from_event(cls, event_data: NodeData) -> Optional["CalculatedHashes"]:
        hashes = event_data.get("hashes")
        hierarchical_hashes = event_data.get("hierarchical_hashes") or []
        if hashes is not None:
            return cls(hashes=hashes, hierarchical_hashes=hierarchical_hashes)

        return None

    def group_metadata_from_hash(self, hash: str) -> EventMetadata:
        try:
            i = self.hierarchical_hashes.index(hash)
            return {
                "current_level": i,
            }
        except (IndexError, ValueError):
            return {}
