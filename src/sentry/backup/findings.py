from __future__ import annotations

from typing import NamedTuple


# TODO(team-ospo/#155): Figure out if we are going to use `pk` as part of the identifier, or some other kind of sequence number internal to the JSON export instead.
class InstanceID(NamedTuple):
    """Every entry in the generated backup JSON file should have a unique model+pk combination,
    which serves as its identifier."""

    model: str
    pk: int

    def pretty(self) -> str:
        return f"InstanceID(model: {self.model!r}, pk: {self.pk})"


class ComparatorFinding(NamedTuple):
    """Store all information about a single failed matching between expected and actual output."""

    kind: str
    on: InstanceID
    reason: str = ""

    def pretty(self) -> str:
        return f"Finding(\n\tkind: {self.kind!r},\n\ton: {self.on.pretty()},\n\treason: {self.reason}\n)"


class ComparatorFindings:
    """A wrapper type for a list of 'ComparatorFinding' which enables pretty-printing in asserts."""

    def __init__(self, findings: list[ComparatorFinding]):
        self.findings = findings

    def append(self, finding: ComparatorFinding) -> None:
        self.findings.append(finding)

    def extend(self, findings: list[ComparatorFinding]) -> None:
        self.findings += findings

    def pretty(self) -> str:
        return "\n".join(f.pretty() for f in self.findings)
