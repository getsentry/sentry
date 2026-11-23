from __future__ import annotations

import dataclasses
from pathlib import Path

import pytest

from tools.api_guidelines.rules import ApiRule
from tools.api_guidelines.signature import BaselineSignature, normalize_path

REPO_ROOT = Path(__file__).resolve().parents[3]


@pytest.mark.parametrize(
    ("path", "expected"),
    [
        ("src/sentry/api/x.py", "src/sentry/api/x.py"),
        ("./src/sentry/api/x.py", "src/sentry/api/x.py"),
        ("src\\sentry\\api\\x.py", "src/sentry/api/x.py"),
        (".\\src\\sentry\\api\\x.py", "src/sentry/api/x.py"),
        # only a leading "./" is removed, never other leading dots
        (".github/workflows/x.yml", ".github/workflows/x.yml"),
    ],
)
def test_normalize_path(path: str, expected: str) -> None:
    assert normalize_path(path) == expected


def test_normalize_path_in_this_checkout() -> None:
    absolute = (REPO_ROOT / "src" / "sentry" / "api" / "x.py").as_posix()
    assert normalize_path(absolute) == "src/sentry/api/x.py"


def test_normalize_path_outside_this_checkout_raises() -> None:
    with pytest.raises(ValueError):
        normalize_path("/somewhere/else/src/sentry/api/x.py")


def test_signature_normalizes_its_path() -> None:
    sig = BaselineSignature(ApiRule.S026, "./src/sentry/api/x.py", "XEndpoint.get", "id")
    assert sig.path == "src/sentry/api/x.py"


def test_same_violation_gives_equal_signatures() -> None:
    a = BaselineSignature(ApiRule.S026, "./src/sentry/api/x.py", "XEndpoint.get", "id")
    b = BaselineSignature(ApiRule.S026, "src/sentry/api/x.py", "XEndpoint.get", "id")
    assert a == b
    assert len({a, b}) == 1


@pytest.mark.parametrize("key", [None, ""])
def test_missing_key_is_none(key: str | None) -> None:
    sig = BaselineSignature(ApiRule.S027, "src/sentry/api/x.py", "XEndpoint.put", key)
    assert sig.key is None


def test_key_defaults_to_none() -> None:
    sig = BaselineSignature(ApiRule.S027, "src/sentry/api/x.py", "XEndpoint.put")
    assert sig.key is None


def test_different_fields_give_different_signatures() -> None:
    base = BaselineSignature(ApiRule.S026, "src/sentry/api/x.py", "XEndpoint.get", "id")
    assert base != BaselineSignature(ApiRule.S025, "src/sentry/api/x.py", "XEndpoint.get", "id")
    assert base != BaselineSignature(ApiRule.S026, "src/sentry/api/y.py", "XEndpoint.get", "id")
    assert base != BaselineSignature(ApiRule.S026, "src/sentry/api/x.py", "XEndpoint.post", "id")
    assert base != BaselineSignature(ApiRule.S026, "src/sentry/api/x.py", "XEndpoint.get", "name")


def test_signature_is_frozen() -> None:
    sig = BaselineSignature(ApiRule.S026, "src/sentry/api/x.py", "XEndpoint.get", "id")
    with pytest.raises(dataclasses.FrozenInstanceError):
        # assigning is the point of this test, so mypy's read-only error is expected
        sig.key = "name"  # type: ignore[misc]


def test_signature_counts_as_dict_key() -> None:
    counts: dict[BaselineSignature, int] = {}
    for path in ("./src/sentry/api/x.py", "src/sentry/api/x.py"):
        sig = BaselineSignature(ApiRule.S026, path, "XEndpoint.get", "id")
        counts[sig] = counts.get(sig, 0) + 1

    assert len(counts) == 1
    assert counts[sig] == 2
