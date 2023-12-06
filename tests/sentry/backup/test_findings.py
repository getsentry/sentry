from __future__ import annotations

from dataclasses import asdict, dataclass
from enum import auto, unique
from typing import Any, Dict

from sentry.backup.dependencies import get_model_name
from sentry.backup.findings import (
    ComparatorFinding,
    ComparatorFindingKind,
    Finding,
    FindingJSONEncoder,
    FindingKind,
    InstanceID,
)
from sentry.models.email import Email
from sentry.services.hybrid_cloud.import_export.model import (
    RpcExportError,
    RpcExportErrorKind,
    RpcImportError,
    RpcImportErrorKind,
)
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

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class FindingsTests(TestCase):
    def test_defaults(self):
        finding = TestFinding(
            on=InstanceID(model=str(get_model_name(Email))),
            reason="test reason",
        )

        assert (
            encoder.encode(finding)
            == """{
    "finding": "TestFinding",
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
    "finding": "TestFinding",
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
        assert (
            finding.pretty()
            == """TestFinding(
    kind: Foo,
    on: InstanceID(model: 'sentry.email', ordinal: 1),
    left_pk: 2,
    right_pk: 3,
    reason: test reason
)"""
        )

    def test_comparator_finding(self):
        finding = ComparatorFinding(
            kind=ComparatorFindingKind.Unknown,
            on=InstanceID(model=str(get_model_name(Email)), ordinal=1),
            left_pk=2,
            right_pk=3,
            reason="test reason",
        )
        assert (
            encoder.encode(finding)
            == """{
    "finding": "ComparatorFinding",
    "kind": "Unknown",
    "left_pk": 2,
    "on": {
        "model": "sentry.email",
        "ordinal": 1
    },
    "reason": "test reason",
    "right_pk": 3
}"""
        )
        assert (
            finding.pretty()
            == """ComparatorFinding(
    kind: Unknown,
    on: InstanceID(model: 'sentry.email', ordinal: 1),
    left_pk: 2,
    right_pk: 3,
    reason: test reason
)"""
        )

    def test_rpc_export_error(self):
        finding = RpcExportError(
            kind=RpcExportErrorKind.Unknown,
            on=InstanceID(model=str(get_model_name(Email)), ordinal=1),
            left_pk=2,
            right_pk=3,
            reason="test reason",
        )
        assert (
            encoder.encode(finding)
            == """{
    "finding": "RpcExportError",
    "kind": "Unknown",
    "left_pk": 2,
    "on": {
        "model": "sentry.email",
        "ordinal": 1
    },
    "reason": "test reason",
    "right_pk": 3
}"""
        )
        assert (
            finding.pretty()
            == """RpcExportError(
    kind: Unknown,
    on: InstanceID(model: 'sentry.email', ordinal: 1),
    left_pk: 2,
    right_pk: 3,
    reason: test reason
)"""
        )

    def test_rpc_import_error(self):
        finding = RpcImportError(
            kind=RpcImportErrorKind.Unknown,
            on=InstanceID(model=str(get_model_name(Email)), ordinal=1),
            left_pk=2,
            right_pk=3,
            reason="test reason",
        )
        assert (
            encoder.encode(finding)
            == """{
    "finding": "RpcImportError",
    "kind": "Unknown",
    "left_pk": 2,
    "on": {
        "model": "sentry.email",
        "ordinal": 1
    },
    "reason": "test reason",
    "right_pk": 3
}"""
        )
        assert (
            finding.pretty()
            == """RpcImportError(
    kind: Unknown,
    on: InstanceID(model: 'sentry.email', ordinal: 1),
    left_pk: 2,
    right_pk: 3,
    reason: test reason
)"""
        )
