from __future__ import annotations

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


class ComparatorFinding(NamedTuple):
    """Store all information about a single failed matching between expected and actual output."""

    kind: str
    on: InstanceID
    left_pk: int | None = None
    right_pk: int | None = None
    reason: str = ""

    def pretty(self) -> str:
        out = f"Finding(\n\tkind: {self.kind!r},\n\ton: {self.on.pretty()}"
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
