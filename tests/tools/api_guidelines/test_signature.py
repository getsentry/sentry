from __future__ import annotations

import dataclasses
from pathlib import Path

import pytest

from tools.api_guidelines.rules import ApiRule
from tools.api_guidelines.signature import (
    MODULE_SCOPE,
    BaselineSignature,
    normalize_path,
    signature_of,
)

REPO_ROOT = Path(__file__).resolve().parents[3]


@pytest.mark.parametrize(
    ("path", "expected"),
    [
        ("src/sentry/api/x.py", "src/sentry/api/x.py"),
        ("./src/sentry/api/x.py", "src/sentry/api/x.py"),
        ("src\\sentry\\api\\x.py", "src/sentry/api/x.py"),
        (".\\src\\sentry\\api\\x.py", "src/sentry/api/x.py"),
        # absolute paths from another checkout, i.e, in CI
        ("/home/ci/sentry/src/sentry/api/x.py", "src/sentry/api/x.py"),
        ("/home/ci/sentry/tests/tools/test_x.py", "tests/tools/test_x.py"),
        ("/home/ci/sentry/tools/flake8_plugin.py", "tools/flake8_plugin.py"),
        # only a leading "./" is removed, never other leading dots
        (".github/workflows/x.yml", ".github/workflows/x.yml"),
    ],
)
def test_normalize_path(path: str, expected: str) -> None:
    assert normalize_path(path) == expected


def test_normalize_path_in_this_checkout() -> None:
    absolute = (REPO_ROOT / "src" / "sentry" / "api" / "x.py").as_posix()
    assert normalize_path(absolute) == "src/sentry/api/x.py"


def test_same_violation_gives_equal_signatures() -> None:
    a = signature_of("S026", "./src/sentry/api/x.py", "XEndpoint.get", "id")
    b = signature_of(ApiRule.S026, "src/sentry/api/x.py", "XEndpoint.get", "id")
    assert a == b
    assert len({a, b}) == 1


def test_rule_is_an_api_rule() -> None:
    sig = signature_of("S026", "src/sentry/api/x.py", "XEndpoint.get")
    assert sig.rule is ApiRule.S026


def test_unknown_rule_raises() -> None:
    with pytest.raises(ValueError):
        signature_of("S099", "src/sentry/api/x.py", "XEndpoint.get")


@pytest.mark.parametrize("key", [None, ""])
def test_missing_key_is_none(key: str | None) -> None:
    assert signature_of("S027", "src/sentry/api/x.py", "XEndpoint.put", key).key is None
    assert signature_of("S027", "src/sentry/api/x.py", "XEndpoint.put").key is None


@pytest.mark.parametrize("scope", [None, ""])
def test_missing_scope_is_module(scope: str | None) -> None:
    assert signature_of("S026", "src/sentry/api/x.py", scope).scope == MODULE_SCOPE


def test_different_fields_give_different_signatures() -> None:
    base = signature_of("S026", "src/sentry/api/x.py", "XEndpoint.get", "id")
    assert base != signature_of("S025", "src/sentry/api/x.py", "XEndpoint.get", "id")
    assert base != signature_of("S026", "src/sentry/api/y.py", "XEndpoint.get", "id")
    assert base != signature_of("S026", "src/sentry/api/x.py", "XEndpoint.post", "id")
    assert base != signature_of("S026", "src/sentry/api/x.py", "XEndpoint.get", "name")


def test_signature_is_frozen() -> None:
    sig = signature_of("S026", "src/sentry/api/x.py", "XEndpoint.get", "id")
    with pytest.raises(dataclasses.FrozenInstanceError):
        sig.key = "name"


def test_signature_counts_as_dict_key() -> None:
    counts: dict[BaselineSignature, int] = {}
    for path in ("./src/sentry/api/x.py", "src/sentry/api/x.py"):
        sig = signature_of("S026", path, "XEndpoint.get", "id")
        counts[sig] = counts.get(sig, 0) + 1
    assert list(counts.values()) == [2]
