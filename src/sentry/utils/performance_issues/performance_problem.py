from dataclasses import dataclass
from typing import Any, Mapping, Optional, Sequence

from sentry.issues.grouptype import GroupType, get_group_type_by_type_id


@dataclass
class PerformanceProblem:
    fingerprint: str
    op: str
    desc: str
    type: GroupType
    parent_span_ids: Optional[Sequence[str]]
    # For related spans that caused the bad spans
    cause_span_ids: Optional[Sequence[str]]
    # The actual bad spans
    offender_span_ids: Sequence[str]

    def to_dict(
        self,
    ) -> Mapping[str, Any]:
        return {
            "fingerprint": self.fingerprint,
            "op": self.op,
            "desc": self.desc,
            "type": self.type.type_id,
            "parent_span_ids": self.parent_span_ids,
            "cause_span_ids": self.cause_span_ids,
            "offender_span_ids": self.offender_span_ids,
        }

    @property
    def title(self) -> str:
        return self.type.description

    @classmethod
    def from_dict(cls, data: dict):
        return cls(
            data["fingerprint"],
            data["op"],
            data["desc"],
            get_group_type_by_type_id(data["type"]),
            data["parent_span_ids"],
            data["cause_span_ids"],
            data["offender_span_ids"],
        )

    def __eq__(self, other):
        if not isinstance(other, PerformanceProblem):
            return NotImplemented
        return (
            self.fingerprint == other.fingerprint
            and self.offender_span_ids == other.offender_span_ids
            and self.type == other.type
        )

    def __hash__(self):
        # This will de-duplicate on fingerprint and type and only for offending span ids.
        # Fingerprint should incorporate the 'uniqueness' enough that parent and span checks etc. are not required.
        return hash((self.fingerprint, frozenset(self.offender_span_ids), self.type))
