from __future__ import annotations

import contextlib
import importlib
import json
import os
from contextlib import AbstractContextManager
from pathlib import Path
from typing import Any
from unittest import mock

import pytest

# Module has a hyphen in its name, so use importlib.
_mod = importlib.import_module("pytest-selected")
Shard = _mod.Shard
main = _mod.main
plan_shards = _mod.plan_shards


class TestPlanShards:
    def test_packs_whole_files_by_weight(self) -> None:
        # 10 + 1 vs 6 + 5
        assert plan_shards({"a.py": 10, "b.py": 6, "c.py": 5, "d.py": 1}, 2) == [
            Shard(["a.py", "d.py"]),
            Shard(["b.py", "c.py"]),
        ]

    def test_splits_a_file_too_big_for_one_shard(self) -> None:
        # 80 tests over 4 shards: big.py is worth 3 shards, the rest share one.
        assert plan_shards({"a.py": 10, "big.py": 60, "b.py": 10}, 4) == [
            Shard(["a.py", "b.py"]),
            Shard(["big.py"], 3, 0),
            Shard(["big.py"], 3, 1),
            Shard(["big.py"], 3, 2),
        ]

    def test_spare_shards_go_to_the_heaviest_file(self) -> None:
        assert plan_shards({"a.py": 3, "b.py": 1}, 3) == [
            Shard(["b.py"]),
            Shard(["a.py"], 2, 0),
            Shard(["a.py"], 2, 1),
        ]

    def test_keeps_a_shard_for_the_small_files(self) -> None:
        # big.py rounds up to both shards on its own.
        assert plan_shards({"big.py": 3, "a.py": 1}, 2) == [Shard(["big.py"]), Shard(["a.py"])]

    def test_every_file_runs_exactly_once(self) -> None:
        weights = {f"t{i}.py": i % 7 + 1 for i in range(37)}
        plan = plan_shards(weights, 5)
        assert len(plan) == 5
        assert all(shard.files and shard.item_groups == 1 for shard in plan)
        assert sorted(f for shard in plan for f in shard.files) == sorted(weights)


def run_main(
    tmp_path: Path,
    selected: list[str],
    counts: dict[str, int],
    total: int,
    group: int,
    exit_code: pytest.ExitCode = pytest.ExitCode.OK,
) -> tuple[int, list[tuple[object, ...]]]:
    selected_file = tmp_path / "selected-tests.txt"
    selected_file.write_text("".join(f"{path}\n" for path in selected))
    if counts:
        (tmp_path / "selected-tests.counts.json").write_text(json.dumps(counts))
    calls: list[tuple[object, ...]] = []

    def fake_main(args: list[str]) -> pytest.ExitCode:
        env = ("SELECTED_TESTS_FILE", "TOTAL_TEST_GROUPS", "TEST_GROUP")
        calls.append((args, *(os.environ[k] for k in env)))
        return exit_code

    env = {
        "SELECTED_TESTS_FILE": str(selected_file),
        "TOTAL_TEST_GROUPS": str(total),
        "TEST_GROUP": str(group),
    }
    with mock.patch.dict(os.environ, env), mock.patch.object(pytest, "main", fake_main):
        return main(["tests", "-q"]), calls


class TestMain:
    def test_runs_only_this_shards_files(self, tmp_path: Path) -> None:
        exit_code, calls = run_main(tmp_path, ["a.py", "b.py"], {"a.py": 5, "b.py": 3}, 2, 1)
        shard_file = tmp_path / "selected-tests.shard-1.txt"
        assert exit_code == 0
        assert calls == [(["tests", "-q"], str(shard_file), "1", "0")]
        assert shard_file.read_text() == "b.py\n"

    def test_split_file_shards_by_test(self, tmp_path: Path) -> None:
        _, calls = run_main(tmp_path, ["a.py", "big.py"], {"a.py": 1, "big.py": 9}, 3, 2)
        assert calls[0][2:] == ("2", "1")
        assert (tmp_path / "selected-tests.shard-2.txt").read_text() == "big.py\n"

    def test_single_shard_runs_pytest_unchanged(self, tmp_path: Path) -> None:
        _, calls = run_main(tmp_path, ["a.py"], {}, 1, 0)
        assert calls == [(["tests", "-q"], str(tmp_path / "selected-tests.txt"), "1", "0")]

    def test_empty_shard_is_not_a_failure(self, tmp_path: Path) -> None:
        exit_code, _ = run_main(
            tmp_path, ["a.py", "b.py"], {}, 2, 0, exit_code=pytest.ExitCode.NO_TESTS_COLLECTED
        )
        assert exit_code == 0


plan_full_shards = _mod.plan_full_shards
item_part = importlib.import_module("pytest_shard_plugin").item_part


def pieces_per_shard(n: int) -> AbstractContextManager[object]:
    return mock.patch.object(_mod, "PIECES_PER_SHARD", n)


def write_files(root: Path, files: list[str], counts: dict[str, int] | None = None) -> None:
    for path in files:
        (root / path).parent.mkdir(parents=True, exist_ok=True)
        (root / path).write_text(
            "".join(f"def test_{i}(): pass\n" for i in range((counts or {}).get(path, 2)))
        )


def assert_runs_every_test_once(plan: list[Any], tests: dict[str, list[str]]) -> None:
    """`tests` maps each file to its test ids. Checks each one runs on exactly one shard."""
    ran: list[str] = []
    for shard in plan:
        for path in shard.files:
            part, parts = shard.parts.get(path, (0, 1))
            ran += [t for t in tests[path] if parts == 1 or item_part(t, parts) == part]
    assert sorted(ran) == sorted(t for ids in tests.values() for t in ids)


class TestPlanFullShards:
    def test_packs_whole_files_by_weight(self) -> None:
        weights = {f"t{i}.py": 1.0 for i in range(24)} | {"z.py": 0.0}
        with pieces_per_shard(1):
            plan = plan_full_shards(weights, 4)
        assert plan is not None
        assert [len(s.files) for s in plan] == [7, 6, 6, 6]
        assert all(not s.parts for s in plan)

    def test_splits_slow_files_across_shards(self) -> None:
        # Shards hold 24s, so files over 2s are cut into 2s parts.
        weights = {"big.py": 10.0} | {f"t{i}.py": 1.0 for i in range(86)}
        with pieces_per_shard(12):
            plan = plan_full_shards(weights, 4)
        assert plan is not None
        holders = [s for s in plan if "big.py" in s.files]
        assert sorted(s.parts["big.py"] for s in holders) == [(i, 4) for i in range(4)]
        assert all(len(s.parts) == 1 for s in plan)

    def test_never_splits_a_file_past_the_shard_count(self) -> None:
        plan = plan_full_shards({"big.py": 100.0, "a.py": 1.0, "b.py": 1.0}, 3)
        assert plan is not None
        assert sorted(s.parts["big.py"] for s in plan) == [(0, 3), (1, 3), (2, 3)]

    def test_no_plan_when_a_shard_would_be_empty(self) -> None:
        assert plan_full_shards({"a.py": 0.0}, 2) is None

    def test_same_weights_same_plan(self) -> None:
        weights = {f"t{i}.py": float(i % 13) for i in range(200)}
        assert plan_full_shards(weights, 7) == plan_full_shards(dict(reversed(weights.items())), 7)

    def test_balances_shards(self) -> None:
        weights = {f"t{i}.py": float(i % 13 + 1) ** 2 for i in range(500)} | {"big.py": 900.0}
        plan = plan_full_shards(weights, 10)
        assert plan is not None
        loads = [
            sum(weights[p] / shard.parts.get(p, (0, 1))[1] for p in shard.files) for shard in plan
        ]
        assert max(loads) - min(loads) <= 1.0

    def test_every_test_runs_exactly_once(self) -> None:
        tests = {f"t{i}.py": [f"t{i}.py::test_{j}" for j in range(i % 50)] for i in range(300)}
        tests["big.py"] = [f"big.py::Test::test_{j}[{k}]" for j in range(40) for k in range(30)]
        weights = {path: len(ids) * 0.5 for path, ids in tests.items()}
        for total in (2, 7, 22):
            plan = plan_full_shards(weights, total)
            assert plan is not None and len(plan) == total
            assert_runs_every_test_once(plan, tests)


def test_list_test_files_lists_python_files_under_roots_minus_ignores(tmp_path: Path) -> None:
    for path in (
        "tests/a/test_a.py",
        "tests/a/helpers.py",
        "tests/a/conftest.py",
        "tests/a/__pycache__/test_a.py",
        "tests/skip/test_s.py",
        "tests/data.json",
        "other/test_o.py",
    ):
        (tmp_path / path).parent.mkdir(parents=True, exist_ok=True)
        (tmp_path / path).touch()
    args = ["tests", "--ignore", "tests/skip", "-o", "x=y", "--junit-xml=out.xml"]
    with contextlib.chdir(tmp_path):
        assert _mod.list_test_files(args) == ["tests/a/helpers.py", "tests/a/test_a.py"]


def run_full_main(
    tmp_path: Path,
    files: list[str],
    counts: dict[str, int] | None,
    total: int,
    group: int,
    addopts: str = "",
) -> tuple[int, list[tuple[object, ...]]]:
    write_files(tmp_path, files, counts)
    calls: list[tuple[object, ...]] = []

    def fake_main(args: list[str]) -> pytest.ExitCode:
        env = ("SELECTED_TESTS_FILE", "TOTAL_TEST_GROUPS", "TEST_GROUP", "PYTEST_SHARD_PARTS")
        calls.append((args, *(os.environ.get(k) for k in env)))
        return pytest.ExitCode.OK

    env = {
        "SELECTED_TESTS_FILE": "",
        "TOTAL_TEST_GROUPS": str(total),
        "TEST_GROUP": str(group),
        "PYTEST_ADDOPTS": addopts,
    }
    with (
        contextlib.chdir(tmp_path),
        mock.patch.dict(os.environ, env),
        mock.patch.object(pytest, "main", fake_main),
    ):
        return main(["tests", "-q"]), calls


class TestFullRunMain:
    def test_runs_only_this_shards_files(self, tmp_path: Path) -> None:
        files = ["tests/test_a.py", "tests/test_b.py", "tests/test_new.py"]
        with pieces_per_shard(1):
            exit_code, calls = run_full_main(tmp_path, files, {"tests/test_a.py": 3}, 2, 1)
        shard_file = ".artifacts/full-tests.shard-1.txt"
        parts_file = ".artifacts/full-tests.shard-1.json"
        assert exit_code == 0
        assert calls == [(["tests", "-q"], shard_file, "1", "0", parts_file)]
        # test_a.py (3 tests) on its own; the others hold 2 tests each.
        assert (tmp_path / shard_file).read_text() == "tests/test_b.py\ntests/test_new.py\n"
        assert json.loads((tmp_path / parts_file).read_text()) == {}

    def test_every_file_runs_once_with_live_counted_weight(self, tmp_path: Path) -> None:
        files = [f"tests/test_{i}.py" for i in range(8)] + ["tests/test_renamed.py"]
        counts = {f"tests/test_{i}.py": 3 for i in range(8)} | {"tests/test_renamed.py": 2}
        write_files(tmp_path, files, counts)
        with (
            contextlib.chdir(tmp_path),
            pieces_per_shard(1),
        ):
            weights = _mod.file_weights(_mod.list_test_files(["tests"]))
            plan = plan_full_shards(weights, 3)
        assert weights == {path: float(n) for path, n in counts.items()}
        assert plan is not None
        assert sorted(f for s in plan for f in s.files) == sorted(files)

    def test_unplannable_files_fall_back_to_hash_sharding(self, tmp_path: Path) -> None:
        # A zero-weight helper file cannot fill two shards, so every shard collects everything.
        _, calls = run_full_main(tmp_path, ["tests/helpers.py"], None, 2, 1)
        assert calls == [(["tests", "-q"], "", "2", "1", None)]

    def test_filtered_run_falls_back_to_hash_sharding(self, tmp_path: Path) -> None:
        _, calls = run_full_main(
            tmp_path, ["tests/test_a.py", "tests/test_b.py"], None, 16, 12, "-m snuba_ci"
        )
        assert calls == [(["tests", "-q"], "", "16", "12", None)]


@pytest.mark.parametrize(
    ("args", "addopts", "files", "applies"),
    [
        (["tests"], "--reruns=5 -n 3 --dist=loadfile", ["tests/a.py"], True),
        (["tests", "--max-worker-restart=1"], "", ["tests/a.py"], True),
        (["tests", "-m", "snuba_ci"], "", ["tests/a.py"], False),
        (["tests", "-msnuba_ci"], "", ["tests/a.py"], False),
        (["tests", "-k", "not slow"], "", ["tests/a.py"], False),
        (["tests"], "-k 'not __In' -m snuba_ci", ["tests/a.py"], False),
        (["/abs/tests"], "", ["/abs/tests/a.py"], False),
        (["../tests"], "", ["../tests/a.py"], False),
    ],
)
def test_per_file_plan_applies(
    args: list[str], addopts: str, files: list[str], applies: bool
) -> None:
    with mock.patch.dict(os.environ, {"PYTEST_ADDOPTS": addopts}):
        assert _mod.per_file_plan_applies(args, files) is applies
