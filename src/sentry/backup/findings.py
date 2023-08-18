from __future__ import annotations

from enum import IntEnum, auto, unique
from typing import NamedTuple


class InstanceID(NamedTuple):
    """Every entry in the generated backup JSON file should have a unique model+ordinal combination,
    which serves as its identifier."""

    model: str

    # The order that this model appeared in the JSON inputs. Because we validate that the same
    # number of models of each kind are present on both the left and right side when validating, we
    # can use the ordinal as a unique identifier.
    ordinal: int | None = None

    def pretty(self) -> str:
        out = f"InstanceID(model: {self.model!r}"
        if self.ordinal:
            out += f", ordinal: {self.ordinal}"
        return out + ")"


@unique
class ComparatorFindingKind(IntEnum):
    # The instances of a particular model did not maintain total ordering of pks (that is, pks did not appear in ascending order, or appear multiple times).
    UnorderedInput = auto()

    # The number of instances of a particular model on the left and right side of the input were not
    # equal.
    UnequalCounts = auto()

    # The JSON of two instances of a model, after certain fields have been scrubbed by all applicable comparators, were not byte-for-byte equivalent.
    UnequalJSON = auto()

    # Two datetime fields were not equal.
    DatetimeEqualityComparator = auto()

    # Failed to compare datetimes because one of the fields being compared was not present or
    # `None`.
    DatetimeEqualityComparatorExistenceCheck = auto()

    # The right side field's datetime value was not greater (ie, "newer") than the left side's.
    DateUpdatedComparator = auto()

    # Failed to compare datetimes because one of the fields being compared was not present or
    # `None`.
    DateUpdatedComparatorExistenceCheck = auto()

    # Email equality comparison failed.
    EmailObfuscatingComparator = auto()

    # Failed to compare emails because one of the fields being compared was not present or
    # `None`.
    EmailObfuscatingComparatorExistenceCheck = auto()

    # Hash equality comparison failed.
    HashObfuscatingComparator = auto()

    # Failed to compare hashes because one of the fields being compared was not present or
    # `None`.
    HashObfuscatingComparatorExistenceCheck = auto()

    # Foreign key field comparison failed.
    ForeignKeyComparator = auto()

    # Failed to compare foreign key fields because one of the fields being compared was not present
    # or `None`.
    ForeignKeyComparatorExistenceCheck = auto()

    # Failed to compare an ignored field.
    IgnoredComparator = auto()

    # Failed to compare an ignored field because one of the fields being compared was not present or
    # `None`.
    IgnoredComparatorExistenceCheck = auto()


class ComparatorFinding(NamedTuple):
    """Store all information about a single failed matching between expected and actual output."""

    kind: ComparatorFindingKind
    on: InstanceID
    left_pk: int | None = None
    right_pk: int | None = None
    reason: str = ""

    def pretty(self) -> str:
        out = f"Finding(\n\tkind: {self.kind.name},\n\ton: {self.on.pretty()}"
        if self.left_pk:
            out += f",\n\tleft_pk: {self.left_pk}"
        if self.right_pk:
            out += f",\n\tright_pk: {self.right_pk}"
        if self.reason:
            out += f",\n\treason: {self.reason}"
        return out + "\n)"


class ComparatorFindings:
    """A wrapper type for a list of 'ComparatorFinding' which enables pretty-printing in asserts."""

    def __init__(self, findings: list[ComparatorFinding]):
        self.findings = findings

    def append(self, finding: ComparatorFinding) -> None:
        self.findings.append(finding)

    def empty(self) -> bool:
        return not self.findings

    def extend(self, findings: list[ComparatorFinding]) -> None:
        self.findings += findings

    def pretty(self) -> str:
        return "\n".join(f.pretty() for f in self.findings)
