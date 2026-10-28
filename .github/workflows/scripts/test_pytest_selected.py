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
    service_color: str = "",
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
        "BACKEND_TEST_SERVICE_COLOR": service_color,
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


def write_files(root: Path, files: list[str]) -> None:
    for path in files:
        (root / path).parent.mkdir(parents=True, exist_ok=True)
        (root / path).write_text("def test_one(): pass\ndef test_two(): pass\n")


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
    durations: dict[str, object] | None,
    total: int,
    group: int,
    addopts: str = "",
    service_color: str = "",
    sources: dict[str, str] | None = None,
) -> tuple[int, list[tuple[object, ...]]]:
    write_files(tmp_path, files)
    for path, content in (sources or {}).items():
        (tmp_path / path).write_text(content)
    durations_file = tmp_path / "durations.json"
    if durations is not None:
        durations_file.write_text(json.dumps(durations))
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
        "BACKEND_TEST_SERVICE_COLOR": service_color,
    }
    with (
        contextlib.chdir(tmp_path),
        mock.patch.dict(os.environ, env),
        mock.patch.object(_mod, "DURATIONS_FILE", durations_file),
        mock.patch.object(pytest, "main", fake_main),
    ):
        return main(["tests", "-q"]), calls


class TestFullRunMain:
    def test_runs_only_this_shards_files(self, tmp_path: Path) -> None:
        files = ["tests/test_a.py", "tests/test_b.py", "tests/test_new.py"]
        durations = {"seconds_per_test": 1.0, "files": {"tests/test_a.py": 3.0}}
        with pieces_per_shard(1):
            exit_code, calls = run_full_main(tmp_path, files, durations, 2, 1)
        shard_file = ".artifacts/full-tests.shard-1.txt"
        parts_file = ".artifacts/full-tests.shard-1.json"
        assert exit_code == 0
        assert calls == [(["tests", "-q"], shard_file, "1", "0", parts_file)]
        # test_a.py (3s) on its own; test_new.py is estimated from its 2 tests.
        assert (tmp_path / shard_file).read_text() == "tests/test_b.py\ntests/test_new.py\n"
        assert json.loads((tmp_path / parts_file).read_text()) == {}

    def test_new_and_renamed_files_run_once_with_estimated_weight(self, tmp_path: Path) -> None:
        # test_renamed.py was test_old.py when the durations were recorded: the stale
        # entry is ignored and the new name is weighted by its 2 tests, like any new file.
        files = [f"tests/test_{i}.py" for i in range(8)] + ["tests/test_renamed.py"]
        durations = {
            "seconds_per_test": 1.5,
            "files": {f"tests/test_{i}.py": 3.0 for i in range(8)} | {"tests/test_old.py": 9.0},
        }
        durations_file = tmp_path / "durations.json"
        durations_file.write_text(json.dumps(durations))
        write_files(tmp_path, files)
        with (
            contextlib.chdir(tmp_path),
            mock.patch.object(_mod, "DURATIONS_FILE", durations_file),
            pieces_per_shard(1),
        ):
            weights = _mod.file_weights(_mod.list_test_files(["tests"]))
            plan = plan_full_shards(weights, 3)
        assert weights["tests/test_renamed.py"] == 3.0
        assert "tests/test_old.py" not in weights
        assert plan is not None
        assert sorted(f for s in plan for f in s.files) == sorted(files)

    def test_without_durations_every_shard_collects_everything(self, tmp_path: Path) -> None:
        _, calls = run_full_main(tmp_path, ["tests/test_a.py"], None, 3, 1)
        assert calls == [(["tests", "-q"], "", "3", "1", None)]

    def test_filtered_run_falls_back_to_hash_sharding(self, tmp_path: Path) -> None:
        durations = {"seconds_per_test": 1.0, "files": {}}
        _, calls = run_full_main(
            tmp_path, ["tests/test_a.py", "tests/test_b.py"], durations, 16, 12, "-m snuba_ci"
        )
        assert calls == [(["tests", "-q"], "", "16", "12", None)]


class TestProcessingServices:
    @pytest.mark.parametrize(
        ("source", "expected"),
        [
            ("from sentry.testutils.skips import requires_symbolicator\n", True),
            ("from sentry.testutils.relay import RelayStoreHelper as Helper\n", True),
            ("@requires_symbolicator\ndef test_live(): pass\n", True),
            ("def test_live(relay_server): pass\n", True),
            ("def test_live(get_relay_minidump_url): pass\n", True),
            ('import pytest\npytestmark = pytest.mark.usefixtures("relay_server")\n', True),
            ("import pytest\npytestmark = pytest.mark.symbolicator\n", True),
            ("# backend-ci: processing\ndef test_live(): pass\n", True),
            ("# relay_server in a comment\ndef test_mocked(): pass\n", False),
            ('EXAMPLE = "RelayStoreHelper"\ndef test_mocked(): pass\n', False),
            ("def test_ordinary(): pass\n", False),
        ],
    )
    def test_source_detection(self, tmp_path: Path, source: str, expected: bool) -> None:
        path = tmp_path / "test_sample.py"
        path.write_text(source)
        assert _mod.needs_processing_services(str(path)) is expected

    def test_invalid_python_fails_closed(self, tmp_path: Path) -> None:
        path = tmp_path / "test_bad.py"
        path.write_text("relay_server = (")
        with pytest.raises(SyntaxError):
            _mod.needs_processing_services(str(path))


class TestServiceColoredShards:
    def test_stable_exact_coverage(self) -> None:
        tests = {f"t{i}.py": [f"t{i}.py::test_{j}" for j in range(50)] for i in range(50)}
        tests["relay.py"] = [f"relay.py::test_{j}[{k}]" for j in range(5) for k in range(8)]
        weights = {path: float(len(ids)) for path, ids in tests.items()}
        plan = _mod.plan_service_colored_shards(weights, 30, {"relay.py"})
        assert len(plan) == 30
        assert plan[0] == Shard(["relay.py"])
        assert all("relay.py" not in shard.files for shard in plan[1:])
        assert_runs_every_test_once(plan, tests)
        assert plan == _mod.plan_service_colored_shards(
            dict(reversed(weights.items())), 30, {"relay.py"}
        )

    def test_empty_general_shards_keep_zero_weight_file(self) -> None:
        plan = _mod.plan_service_colored_shards({"relay.py": 0.0, "zero.py": 0.0}, 30, {"relay.py"})
        assert plan[0] == Shard(["relay.py"])
        assert plan[1] == Shard(["zero.py"])
        assert all(shard == Shard([]) for shard in plan[2:])

    def test_detected_processing_file_stays_whole(self, tmp_path: Path) -> None:
        files = ["tests/test_relay.py", "tests/test_general.py"]
        code, calls = run_full_main(
            tmp_path,
            files,
            {"seconds_per_test": 1.0, "files": {}},
            30,
            0,
            service_color="processing",
            sources={files[0]: "def test_live(relay_server): pass\n"},
        )
        assert code == 0 and len(calls) == 1
        assert (tmp_path / ".artifacts/full-tests.shard-0.txt").read_text() == (
            "tests/test_relay.py\n"
        )

    def test_new_files_run_in_general_shards(self, tmp_path: Path) -> None:
        files = ["tests/test_relay.py", "tests/test_new.py"]
        code, calls = run_full_main(
            tmp_path,
            files,
            {"seconds_per_test": 1.0, "files": {}},
            30,
            1,
            service_color="general",
            sources={files[0]: "def test_live(relay_server): pass\n"},
        )
        assert code == 0 and len(calls) == 1
        assert (tmp_path / ".artifacts/full-tests.shard-1.txt").read_text() == (
            "tests/test_new.py\n"
        )

    @pytest.mark.parametrize(
        ("total", "group", "color", "addopts"),
        [
            (29, 0, "processing", ""),
            (30, 30, "general", ""),
            (30, 0, "general", ""),
            (30, 1, "processing", ""),
            (30, 1, "unexpected", ""),
            (30, 1, "general", "-m snuba_ci"),
            (30, 1, "general", "-k test_one"),
        ],
    )
    def test_bad_coloring_fails_closed(
        self, tmp_path: Path, total: int, group: int, color: str, addopts: str
    ) -> None:
        code, calls = run_full_main(
            tmp_path,
            ["tests/test_a.py"],
            {"seconds_per_test": 1.0, "files": {}},
            total,
            group,
            addopts=addopts,
            service_color=color,
        )
        assert code == pytest.ExitCode.USAGE_ERROR and calls == []

    def test_missing_durations_fails_closed(self, tmp_path: Path) -> None:
        code, calls = run_full_main(
            tmp_path,
            ["tests/test_a.py"],
            None,
            30,
            1,
            service_color="general",
        )
        assert code == pytest.ExitCode.USAGE_ERROR and calls == []

    def test_empty_inventory_fails_closed(self, tmp_path: Path) -> None:
        code, calls = run_full_main(
            tmp_path,
            [],
            {"seconds_per_test": 1.0, "files": {}},
            30,
            0,
            service_color="processing",
        )
        assert code == pytest.ExitCode.USAGE_ERROR and calls == []

    def test_coloring_and_selected_files_are_incompatible(self, tmp_path: Path) -> None:
        code, calls = run_main(
            tmp_path,
            ["tests/test_a.py"],
            {},
            30,
            1,
            service_color="general",
        )
        assert code == pytest.ExitCode.USAGE_ERROR and calls == []

    def test_empty_colored_shard_skips_pytest(self, tmp_path: Path) -> None:
        code, calls = run_full_main(
            tmp_path,
            ["tests/test_new.py"],
            {"seconds_per_test": 1.0, "files": {}},
            30,
            0,
            service_color="processing",
        )
        assert code == 0 and calls == []


class TestServiceColorFixtureGuard:
    @pytest.mark.parametrize(
        "fixture",
        ["relay_server", "relay_server_setup", "_requires_symbolicator", "get_relay_minidump_url"],
    )
    def test_general_rejects_processing_fixture(self, fixture: str) -> None:
        item = mock.Mock(nodeid="tests/test_indirect.py::test_case", fixturenames=[fixture])
        with (
            mock.patch.dict(
                os.environ,
                {"BACKEND_TEST_SERVICE_COLOR": "general", "PYTEST_SHARD_PARTS": ""},
            ),
            pytest.raises(pytest.UsageError, match="backend-ci: processing"),
        ):
            importlib.import_module("pytest_shard_plugin").pytest_collection_modifyitems(
                mock.Mock(), [item]
            )

    @pytest.mark.parametrize("color", ["", "processing"])
    def test_other_colors_allow_processing_fixtures(self, color: str) -> None:
        item = mock.Mock(nodeid="tests/test_relay.py::test_case", fixturenames=["relay_server"])
        with mock.patch.dict(
            os.environ, {"BACKEND_TEST_SERVICE_COLOR": color, "PYTEST_SHARD_PARTS": ""}
        ):
            importlib.import_module("pytest_shard_plugin").pytest_collection_modifyitems(
                mock.Mock(), [item]
            )

    def test_general_allows_ordinary_fixture(self) -> None:
        item = mock.Mock(
            nodeid="tests/test_general.py::test_case", fixturenames=["_requires_snuba"]
        )
        with mock.patch.dict(
            os.environ, {"BACKEND_TEST_SERVICE_COLOR": "general", "PYTEST_SHARD_PARTS": ""}
        ):
            importlib.import_module("pytest_shard_plugin").pytest_collection_modifyitems(
                mock.Mock(), [item]
            )

    def test_guard_only_checks_retained_slices(self, tmp_path: Path) -> None:
        discarded = mock.Mock(
            nodeid="tests/test_split.py::test_relay", fixturenames=["relay_server"]
        )
        retained = mock.Mock(nodeid="tests/test_general.py::test_case", fixturenames=[])
        parts_file = tmp_path / "parts.json"
        parts_file.write_text(
            json.dumps({"tests/test_split.py": [1 - item_part(discarded.nodeid, 2), 2]})
        )
        items = [discarded, retained]
        config = mock.Mock()
        with mock.patch.dict(
            os.environ,
            {
                "BACKEND_TEST_SERVICE_COLOR": "general",
                "PYTEST_SHARD_PARTS": str(parts_file),
            },
        ):
            importlib.import_module("pytest_shard_plugin").pytest_collection_modifyitems(
                config, items
            )
        assert items == [retained]
        config.hook.pytest_deselected.assert_called_once_with(items=[discarded])


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
