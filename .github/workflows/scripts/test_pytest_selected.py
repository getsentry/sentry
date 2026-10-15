from __future__ import annotations

import importlib
import json
import os
from unittest import mock

import pytest

# Module has a hyphen in its name, so use importlib.
_mod = importlib.import_module("pytest-selected")
Shard = _mod.Shard
main = _mod.main
plan_shards = _mod.plan_shards


class TestPlanShards:
    def test_packs_whole_files_by_weight(self):
        # 10 + 1 vs 6 + 5
        assert plan_shards({"a.py": 10, "b.py": 6, "c.py": 5, "d.py": 1}, 2) == [
            Shard(["a.py", "d.py"]),
            Shard(["b.py", "c.py"]),
        ]

    def test_splits_a_file_too_big_for_one_shard(self):
        # 80 tests over 4 shards: big.py is worth 3 shards, the rest share one.
        assert plan_shards({"a.py": 10, "big.py": 60, "b.py": 10}, 4) == [
            Shard(["a.py", "b.py"]),
            Shard(["big.py"], 3, 0),
            Shard(["big.py"], 3, 1),
            Shard(["big.py"], 3, 2),
        ]

    def test_spare_shards_go_to_the_heaviest_file(self):
        assert plan_shards({"a.py": 3, "b.py": 1}, 3) == [
            Shard(["b.py"]),
            Shard(["a.py"], 2, 0),
            Shard(["a.py"], 2, 1),
        ]

    def test_keeps_a_shard_for_the_small_files(self):
        # big.py rounds up to both shards on its own.
        assert plan_shards({"big.py": 3, "a.py": 1}, 2) == [Shard(["big.py"]), Shard(["a.py"])]

    def test_every_file_runs_exactly_once(self):
        weights = {f"t{i}.py": i % 7 + 1 for i in range(37)}
        plan = plan_shards(weights, 5)
        assert len(plan) == 5
        assert all(shard.files and shard.item_groups == 1 for shard in plan)
        assert sorted(f for shard in plan for f in shard.files) == sorted(weights)


def run_main(tmp_path, selected, counts, total, group, exit_code=pytest.ExitCode.OK):
    selected_file = tmp_path / "selected-tests.txt"
    selected_file.write_text("".join(f"{path}\n" for path in selected))
    if counts:
        (tmp_path / "selected-tests.counts.json").write_text(json.dumps(counts))
    calls = []

    def fake_main(args):
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
    def test_runs_only_this_shards_files(self, tmp_path):
        exit_code, calls = run_main(tmp_path, ["a.py", "b.py"], {"a.py": 5, "b.py": 3}, 2, 1)
        shard_file = tmp_path / "selected-tests.shard-1.txt"
        assert exit_code == 0
        assert calls == [(["tests", "-q"], str(shard_file), "1", "0")]
        assert shard_file.read_text() == "b.py\n"

    def test_split_file_shards_by_test(self, tmp_path):
        _, calls = run_main(tmp_path, ["a.py", "big.py"], {"a.py": 1, "big.py": 9}, 3, 2)
        assert calls[0][2:] == ("2", "1")
        assert (tmp_path / "selected-tests.shard-2.txt").read_text() == "big.py\n"

    def test_single_shard_runs_pytest_unchanged(self, tmp_path):
        _, calls = run_main(tmp_path, ["a.py"], {}, 1, 0)
        assert calls == [(["tests", "-q"], str(tmp_path / "selected-tests.txt"), "1", "0")]

    def test_empty_shard_is_not_a_failure(self, tmp_path):
        exit_code, _ = run_main(
            tmp_path, ["a.py", "b.py"], {}, 2, 0, exit_code=pytest.ExitCode.NO_TESTS_COLLECTED
        )
        assert exit_code == 0
