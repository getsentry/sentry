from __future__ import annotations

import importlib
import json
import math
from pathlib import Path
from typing import Any

import pytest

# Module has a hyphen in its name, so use importlib.
_mod = importlib.import_module("backend-test-durations")

ENV = {
    "GITHUB_SHA": "abc123",
    "GITHUB_RUN_ID": "42",
    "GITHUB_RUN_ATTEMPT": "1",
    "TEST_GROUP": "0",
    "TOTAL_TEST_GROUPS": "2",
}


def test_extract_sums_stages_per_file(tmp_path: Path) -> None:
    report = tmp_path / "pytest.json"
    report.write_text(
        json.dumps(
            {
                "tests": [
                    {
                        "nodeid": "tests/a.py::T::test_1",
                        "setup": {"duration": 1.0},
                        "call": {"duration": 2.0},
                        "teardown": {"duration": 0.5},
                        # Ran inside the call above; counting them again would double it.
                        "subtests": [{"duration": 1.5}, {"duration": 0.4}],
                        "reruns": [{"setup": {"duration": 9.0}, "call": {"duration": 9.0}}],
                    },
                    {"nodeid": "tests/a.py::test_2[x]", "setup": {"duration": 0.5}},
                    {"nodeid": "tests/b.py::test_3", "call": {"duration": 4.0}},
                ]
            }
        )
    )
    assert _mod.extract(report, ENV) == {
        "schema": 1,
        "unit": "seconds",
        "commit": "abc123",
        "run_id": "42",
        "run_attempt": "1",
        "shard": 0,
        "shards": 2,
        "files": {"tests/a.py": 4.0, "tests/b.py": 4.0},
        "tests": 3,
    }


def shard(
    index: int, files: dict[str, float], tests: int = 2, **overrides: object
) -> dict[str, Any]:
    return {
        "schema": 1,
        "unit": "seconds",
        "commit": "abc123",
        "run_id": "42",
        "run_attempt": "1",
        "shard": index,
        "shards": 2,
        "files": files,
        "tests": tests,
    } | overrides


def test_merge_adds_up_shards() -> None:
    shards = [shard(0, {"tests/a.py": 1.04, "tests/b.py": 2.0}), shard(1, {"tests/a.py": 1.0})]
    assert _mod.merge(shards) == {
        "source": {"commit": "abc123", "run_id": "42", "run_attempt": "1", "shards": 2},
        "seconds_per_test": 1.01,
        "files": {"tests/a.py": 2.0, "tests/b.py": 2.0},
    }


@pytest.mark.parametrize(
    ("shards", "error"),
    [
        ([shard(0, {})], "expected shards 0..1 once each"),
        ([shard(0, {}), shard(0, {})], "expected shards 0..1 once each"),
        ([shard(0, {}), shard(1, {}, run_attempt="2")], "more than one run"),
        ([shard(0, {}), shard(1, {}, commit="def456")], "more than one run"),
        ([shard(0, {}, commit=None), shard(1, {}, commit=None)], "missing run details"),
        ([shard(0, {"tests/a.py": math.nan}), shard(1, {})], "non-finite"),
        ([shard(0, {"tests/a.py": -1.0}), shard(1, {})], "non-finite"),
        ([{"files": {}, "tests": 1}], "unsupported durations format"),
        ([], "no shard durations"),
    ],
)
def test_merge_rejects_inconsistent_shards(shards: list[dict[str, Any]], error: str) -> None:
    with pytest.raises(ValueError, match=error):
        _mod.merge(shards)
