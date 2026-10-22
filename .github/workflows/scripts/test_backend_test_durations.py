from __future__ import annotations

import importlib
import json
from pathlib import Path

# Module has a hyphen in its name, so use importlib.
_mod = importlib.import_module("backend-test-durations")


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
                        # Subtests ran inside the call; reruns don't count.
                        "subtests": [{"duration": 1.5}],
                        "reruns": [{"call": {"duration": 9.0}}],
                    },
                    {"nodeid": "tests/a.py::test_2[x]", "setup": {"duration": 0.5}},
                    {"nodeid": "tests/b.py::test_3", "call": {"duration": 4.0}},
                ]
            }
        )
    )
    assert _mod.extract(report) == {"files": {"tests/a.py": 4.0, "tests/b.py": 4.0}, "tests": 3}


def test_merge_adds_up_shards() -> None:
    shards = [
        {"files": {"tests/a.py": 1.04, "tests/b.py": 2.0}, "tests": 2},
        {"files": {"tests/a.py": 1.0}, "tests": 2},
    ]
    assert _mod.merge(shards) == {
        "seconds_per_test": 1.01,
        "files": {"tests/a.py": 2.0, "tests/b.py": 2.0},
    }
