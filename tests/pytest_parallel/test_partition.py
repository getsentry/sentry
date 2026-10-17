from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import Mock, patch

import pytest

from pytest_parallel.coordinator import (
    Coordinator,
    _assert_safe_to_start_workers,
    _extract_parallel_groups,
    _multiprocessing_context,
)
from pytest_parallel.scheduling import FileUnit, assign_units, merge_units


def _make_item(nodeid: str) -> Mock:
    item = Mock()
    item.nodeid = nodeid
    item.location = (nodeid.split("::")[0], None, nodeid)
    return item


def _assigned_nodeids(
    items: list[Mock], num_workers: int, balance: str = "round-robin"
) -> list[list[str]]:
    files: list[FileUnit] = []
    by_key: dict[str, FileUnit] = {}
    for item in items:
        key = item.nodeid.partition("::")[0]
        file_unit = by_key.get(key)
        if file_unit is None:
            file_unit = FileUnit(path=Path(key), key=key, ordinal=len(files))
            by_key[key] = file_unit
            files.append(file_unit)
        file_unit.items.append(item)
        file_unit.groups.update(_extract_parallel_groups(item))
    for file_unit in files:
        file_unit.weight = float(len(file_unit.items))
    buckets = assign_units(merge_units(files), num_workers, balance=balance)
    return [[item.nodeid for unit in bucket for item in unit.items] for bucket in buckets]


def test_round_robin_preserves_file_order() -> None:
    items = [
        _make_item("a.py::test_1"),
        _make_item("a.py::test_2"),
        _make_item("b.py::test_1"),
        _make_item("c.py::test_1"),
        _make_item("c.py::test_2"),
        _make_item("d.py::test_1"),
        _make_item("e.py::test_1"),
    ]

    buckets = _assigned_nodeids(items, 3)

    assert buckets[0] == ["a.py::test_1", "a.py::test_2", "d.py::test_1"]
    assert buckets[1] == ["b.py::test_1", "e.py::test_1"]
    assert buckets[2] == ["c.py::test_1", "c.py::test_2"]


def test_preserves_test_order_within_file() -> None:
    items = [
        _make_item("f.py::TestA::test_3"),
        _make_item("f.py::TestA::test_1"),
        _make_item("f.py::TestB::test_2"),
    ]

    buckets = _assigned_nodeids(items, 2)

    assert buckets[0] == [
        "f.py::TestA::test_3",
        "f.py::TestA::test_1",
        "f.py::TestB::test_2",
    ]
    assert buckets[1] == []


def test_single_worker_gets_everything() -> None:
    items = [_make_item(f"f{i}.py::test") for i in range(5)]

    buckets = _assigned_nodeids(items, 1)

    assert len(buckets) == 1
    assert len(buckets[0]) == 5


def test_more_workers_than_files() -> None:
    items = [_make_item("a.py::test_1"), _make_item("b.py::test_1")]

    buckets = _assigned_nodeids(items, 4)

    assert buckets[0] == ["a.py::test_1"]
    assert buckets[1] == ["b.py::test_1"]
    assert buckets[2] == []
    assert buckets[3] == []


def test_spawn_uses_multiprocessing_context(tmp_path: Path) -> None:
    config = Mock()
    config.hook.pytest_parallel_worker_env = Mock()
    config.known_args_namespace.file_or_dir = []
    config.rootpath = tmp_path
    coordinator = Coordinator(cast(Any, config), 1)
    coordinator._work_dir = tmp_path
    coordinator._num_workers = 1

    context = Mock()
    process = Mock()
    context.Process.return_value = process
    with (
        patch("pytest_parallel.coordinator._multiprocessing_context", return_value=context),
        patch.object(coordinator, "_forwarded_args", return_value=[]),
    ):
        workers = coordinator._spawn([(0, ["tests/test_example.py::test_ok"])])

    args = context.Process.call_args.kwargs["args"]
    assert args[0]["PYTEST_PARALLEL_WORKER_ID"] == "0"
    assert args[0]["PYTEST_PARALLEL_WORKER_COUNT"] == "1"
    assert "_PYTEST_PARALLEL_WORKER_ENTRY" not in args[0]
    assert args[1] == ["tests/test_example.py::test_ok"]
    assert args[2] == []
    assert args[3] == str(tmp_path)
    assert args[4] == tmp_path / "worker_0_results.jsonl"
    assert args[5] == tmp_path / "worker_0_output.txt"
    process.start.assert_called_once_with()
    assert workers == [
        (0, process, tmp_path / "worker_0_results.jsonl", tmp_path / "worker_0_output.txt")
    ]


def test_forwarded_args_strips_jobs_options() -> None:
    config = Mock()
    config.known_args_namespace.file_or_dir = ["tests/"]
    coordinator = Coordinator(cast(Any, config), 1)

    with patch(
        "pytest_parallel.coordinator.sys.argv", ["pytest", "tests/", "-q", "-j", "4", "--jobs=8"]
    ):
        args = coordinator._forwarded_args()

    assert args == ["-q"]


def test_forwarded_args_sanitizes_ini_and_pytest_addopts(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    config = Mock()
    config.known_args_namespace.file_or_dir = ["tests/", "from-ini", "from-env"]
    config.invocation_params.args = ("tests/", "-k", "keep-me", "--log-file=cli.log")
    config.invocation_params.plugins = ()
    config.option = SimpleNamespace(basetemp=str(tmp_path / "base"), log_file="cli.log")
    config.rootpath = tmp_path
    config.getini = lambda name: {
        "addopts": [
            "-pcacheprovider",
            "-p",
            "pytest_cacheprovider",
            "--junitxml=ini.xml",
            "--basetemp",
            str(tmp_path / "ini-base"),
            "--lf",
            "from-ini",
            "-m",
            "slow",
        ],
        "log_file": "ini.log",
    }.get(name)
    coordinator = Coordinator(cast(Any, config), 2)
    monkeypatch.setenv(
        "PYTEST_ADDOPTS",
        f"-p pytest_cacheprovider --junit-xml=env.xml --basetemp={tmp_path / 'env-base'} from-env -q",
    )

    args = coordinator._forwarded_args(worker_id=1)

    assert args == [
        "-m",
        "slow",
        "-q",
        "-k",
        "keep-me",
        "--override-ini=addopts=",
        "--log-file=cli.worker-1.log",
        f"--basetemp={tmp_path / 'base' / 'worker-1'}",
        f"--override-ini=cache_dir={tmp_path / 'base' / 'worker-1' / 'pytest-cache'}",
    ]


def test_multiprocessing_context_uses_spawn_on_macos() -> None:
    with (
        patch("pytest_parallel.coordinator.platform.system", return_value="Darwin"),
        patch("pytest_parallel.coordinator.multiprocessing.get_context") as get_context,
    ):
        _multiprocessing_context()

    get_context.assert_called_once_with("spawn")


def test_multiprocessing_context_uses_forkserver_on_linux() -> None:
    with (
        patch("pytest_parallel.coordinator.platform.system", return_value="Linux"),
        patch("pytest_parallel.coordinator.multiprocessing.get_context") as get_context,
    ):
        _multiprocessing_context()

    get_context.assert_called_once_with("forkserver")


def test_linux_fork_guard_rejects_active_background_threads() -> None:
    main = Mock()
    thread = Mock()
    thread.name = "plugin-thread"
    thread.is_alive.return_value = True

    with (
        patch("pytest_parallel.coordinator.platform.system", return_value="Linux"),
        patch("pytest_parallel.coordinator.threading.main_thread", return_value=main),
        patch("pytest_parallel.coordinator.threading.enumerate", return_value=[main, thread]),
        pytest.raises(pytest.UsageError, match="plugin-thread"),
    ):
        _assert_safe_to_start_workers("fork")


def test_spawn_platforms_skip_thread_guard() -> None:
    thread = Mock()
    thread.is_alive.return_value = True

    with (
        patch("pytest_parallel.coordinator.platform.system", return_value="Darwin"),
        patch("pytest_parallel.coordinator.threading.enumerate", return_value=[thread]),
    ):
        _assert_safe_to_start_workers()


def test_explicit_spawn_on_linux_skips_thread_guard() -> None:
    thread = Mock()
    thread.is_alive.return_value = True

    with (
        patch("pytest_parallel.coordinator.platform.system", return_value="Linux"),
        patch("pytest_parallel.coordinator.threading.enumerate", return_value=[thread]),
    ):
        _assert_safe_to_start_workers("spawn")


def test_unsupported_start_method_raises_usage_error() -> None:
    with (
        patch(
            "pytest_parallel.coordinator.multiprocessing.get_context",
            side_effect=ValueError("no fork"),
        ),
        pytest.raises(pytest.UsageError, match="not supported"),
    ):
        _multiprocessing_context("fork")


def test_count_balance_assigns_largest_files_first_and_preserves_order() -> None:
    items = [
        _make_item("small_a.py::test_1"),
        _make_item("small_b.py::test_1"),
        _make_item("heavy.py::test_1"),
        _make_item("heavy.py::test_2"),
        _make_item("heavy.py::test_3"),
        _make_item("heavy.py::test_4"),
        _make_item("medium.py::test_1"),
        _make_item("medium.py::test_2"),
    ]

    buckets = _assigned_nodeids(items, 2, balance="count")

    assert buckets[0] == [
        "heavy.py::test_1",
        "heavy.py::test_2",
        "heavy.py::test_3",
        "heavy.py::test_4",
    ]
    assert buckets[1] == [
        "small_a.py::test_1",
        "small_b.py::test_1",
        "medium.py::test_1",
        "medium.py::test_2",
    ]


def _make_marked_item(
    nodeid: str,
    groups: list[tuple[object, ...]],
    kwargs_list: list[dict[str, object]] | None = None,
) -> Mock:
    item = _make_item(nodeid)
    marks = []
    for idx, args in enumerate(groups):
        mark = Mock()
        mark.args = args
        mark.kwargs = kwargs_list[idx] if kwargs_list and idx < len(kwargs_list) else {}
        marks.append(mark)
    item.iter_markers = lambda name: iter(marks) if name == "parallel_group" else iter(())
    return item


def test_parallel_group_combines_connected_files_without_mutating_nodeid() -> None:
    items = [
        _make_marked_item("f1.py::test_a", [(" db ",)]),
        _make_item("f2.py::test_b"),
        _make_marked_item("f3.py::test_c", [("db", "cache")]),
        _make_marked_item("f4.py::test_d", [("cache",)]),
    ]

    buckets = _assigned_nodeids(items, 2)

    assert buckets[0] == [
        "f1.py::test_a",
        "f3.py::test_c",
        "f4.py::test_d",
    ]
    assert buckets[1] == ["f2.py::test_b"]


def test_parallel_group_rejects_empty_or_non_string_names() -> None:
    bad_empty = [_make_marked_item("f1.py::test_a", [("   ",)])]
    with pytest.raises(pytest.UsageError, match="non-empty"):
        _extract_parallel_groups(bad_empty[0])

    bad_no_args = [_make_marked_item("f1.py::test_a", [()])]
    with pytest.raises(pytest.UsageError, match="at least one"):
        _extract_parallel_groups(bad_no_args[0])

    bad_kwarg = [_make_marked_item("f1.py::test_a", [("db",)], [{"extra": 1}])]
    with pytest.raises(pytest.UsageError, match="unexpected keyword"):
        _extract_parallel_groups(bad_kwarg[0])


def test_forwarded_args_uses_invocation_params_and_strips_coordinator_flags(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    config = Mock()
    config.known_args_namespace.file_or_dir = ["tests/"]
    config.invocation_params.args = (
        "tests/",
        "-k",
        "tests/",
        "--ramp=2s",
        "--parallel-balance",
        "count",
        "--parallel-start-method=spawn",
        "--parallel-drain=1s",
        "--parallel-collection",
        "manifest",
        "--parallel-collection=nodeid",
        "--parallel-network=inherit",
        "--junitxml=out.xml",
        "--rootdir=/tmp",
        "-j2",
        "-v",
        "-p",
        "cacheprovider",
        "-p",
        "no:cacheprovider",
    )
    config.invocation_params.plugins = ("my_custom_plugin", "pytest_cacheprovider")
    config.option = SimpleNamespace(basetemp=None, log_file=None)
    config.getini = lambda name: [] if name == "addopts" else None
    config.rootpath = tmp_path
    coordinator = Coordinator(cast(Any, config), 2)
    coordinator._work_dir = tmp_path
    monkeypatch.delenv("PYTEST_ADDOPTS", raising=False)

    assert coordinator._forwarded_args() == [
        "-k",
        "tests/",
        "--parallel-network=inherit",
        "-v",
        "-p",
        "no:cacheprovider",
        "-p",
        "my_custom_plugin",
    ]
    worker_args = coordinator._forwarded_args(worker_id=0)
    assert worker_args == [
        "-k",
        "tests/",
        "--parallel-network=inherit",
        "-v",
        "-p",
        "no:cacheprovider",
        "-p",
        "my_custom_plugin",
        "--override-ini=addopts=",
        "--override-ini=log_file=",
        f"--basetemp={tmp_path / 'basetemp' / 'worker-0'}",
        f"--override-ini=cache_dir={tmp_path / 'basetemp' / 'worker-0' / 'pytest-cache'}",
    ]
    assert not any(
        arg.startswith(("--junitxml", "--junit-xml", "--parallel-drain")) for arg in worker_args
    )
    assert "cacheprovider" not in worker_args
    assert "pytest_cacheprovider" not in worker_args
    assert "--lf" not in worker_args
