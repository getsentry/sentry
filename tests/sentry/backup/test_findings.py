from __future__ import annotations

from dataclasses import dataclass
from enum import auto, unique

from sentry.backup.dependencies import get_model_name
from sentry.backup.findings import Finding, FindingJSONEncoder, FindingKind, InstanceID
from sentry.models.email import Email
from sentry.testutils.cases import TestCase

encoder = FindingJSONEncoder(
    sort_keys=True,
    ensure_ascii=True,
    check_circular=True,
    allow_nan=True,
    indent=4,
    encoding="utf-8",
)


@unique
class TestFindingKind(FindingKind):
    __test__ = False

    Unknown = auto()
    Foo = auto()
    Bar = auto()


@dataclass(frozen=True)
class TestFinding(Finding):
    __test__ = False

    kind: TestFindingKind = TestFindingKind.Unknown

    def pretty(self) -> str:
        out = f"TestFinding(\n    kind: {self.kind.name},\n    on: {self.on.pretty()}"
        if self.left_pk:
            out += f",\n    left_pk: {self.left_pk}"
        if self.right_pk:
            out += f",\n    right_pk: {self.right_pk}"
        if self.reason:
            out += f",\n    reason: {self.reason}"
        return out + "\n)"


class FindingsTests(TestCase):
    def test_defaults(self):
        finding = TestFinding(
            on=InstanceID(model=str(get_model_name(Email))),
            reason="test reason",
        )

        assert (
            encoder.encode(finding)
            == """{
    "kind": "Unknown",
    "left_pk": null,
    "on": {
        "model": "sentry.email",
        "ordinal": null
    },
    "reason": "test reason",
    "right_pk": null
}"""
        )
        assert (
            finding.pretty()
            == """TestFinding(
    kind: Unknown,
    on: InstanceID(model: 'sentry.email'),
    reason: test reason
)"""
        )

    def test_no_nulls(self):
        finding = TestFinding(
            kind=TestFindingKind.Foo,
            on=InstanceID(model=str(get_model_name(Email)), ordinal=1),
            left_pk=2,
            right_pk=3,
            reason="test reason",
        )
        assert (
            encoder.encode(finding)
            == """{
    "kind": "Foo",
    "left_pk": 2,
    "on": {
        "model": "sentry.email",
        "ordinal": 1
    },
    "reason": "test reason",
    "right_pk": 3
}"""
        )
