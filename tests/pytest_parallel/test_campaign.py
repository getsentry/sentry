from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any
from unittest.mock import Mock

import pytest

from pytest_parallel.api import Shard
from pytest_parallel.scheduling import FileUnit, assign_units, merge_units


def _clean_env() -> dict[str, str]:
    env = os.environ.copy()
    env.pop("_PYTEST_PARALLEL_WORKER", None)
    env.pop("_PYTEST_PARALLEL_WORKER_ENTRY", None)
    env.pop("PYTEST_PARALLEL_WORKER_ID", None)
    return env


def _run(
    args: list[str], cwd: Path, *, merge_output: bool = True
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", "pytest", *args],
        cwd=cwd,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT if merge_output else subprocess.PIPE,
        env=_clean_env(),
    )


def _plan_json(output: str) -> dict[str, Any]:
    start = output.index("{")
    plan, _ = json.JSONDecoder().raw_decode(output[start:])
    return plan


def _item(nodeid: str) -> Mock:
    item = Mock()
    item.nodeid = nodeid
    item.location = (nodeid.split("::")[0], None, nodeid)
    item.path = None
    item.iter_markers = lambda name: iter(())
    return item


def test_default_balance_is_count_in_plugin() -> None:
    from pytest_parallel.plugin import _parse_balance

    assert _parse_balance("count") == "count"
    light = FileUnit(path=Path("a.py"), key="a.py", ordinal=0)
    light.items = [_item("a.py::t1")]
    light.weight = 1.0
    heavy = FileUnit(path=Path("big.py"), key="big.py", ordinal=1)
    heavy.items = [_item("big.py::t1"), _item("big.py::t2"), _item("big.py::t3")]
    heavy.weight = 3.0
    buckets = assign_units(merge_units([light, heavy]), 2, balance="count")
    assert buckets[0][0].items[0].nodeid == "big.py::t1"


def test_lpt_deterministic_ties_and_round_robin_units() -> None:
    def fu(name: str, count: int, ordinal: int) -> FileUnit:
        unit = FileUnit(path=Path(name), key=name, ordinal=ordinal)
        unit.items = [_item(f"{name}::t{i}") for i in range(count)]
        unit.weight = float(count)
        return unit

    units = merge_units([fu("a.py", 2, 0), fu("b.py", 2, 1), fu("c.py", 1, 2)])
    buckets = assign_units(units, 2, balance="count")
    assert [[u.files[0].name for u in b] for b in buckets] == [["a.py", "c.py"], ["b.py"]]
    rr = assign_units(units, 2, balance="round-robin")
    assert [[u.files[0].name for u in b] for b in rr] == [["a.py", "c.py"], ["b.py"]]


def test_shard_is_frozen() -> None:
    shard = Shard(files=(Path("a.py"),), nodeids=("a.py::t",), weight=1.0, groups=(), ordinal=0)
    import dataclasses

    with pytest.raises(dataclasses.FrozenInstanceError):
        shard.__setattr__("weight", 2.0)


def test_hooks_weights_groups_and_pin_via_plan(tmp_path: Path) -> None:
    (tmp_path / "test_heavy.py").write_text(
        "def test_a():\n assert True\ndef test_b():\n assert True\n"
    )
    (tmp_path / "test_light.py").write_text("def test_c():\n assert True\n")
    (tmp_path / "test_db1.py").write_text("def test_d():\n assert True\n")
    (tmp_path / "test_db2.py").write_text("def test_e():\n assert True\n")
    (tmp_path / "conftest.py").write_text(
        "from pathlib import Path\n"
        "def pytest_parallel_file_weight(path, items):\n"
        "    return 10.0 if path.name == 'test_heavy.py' else None\n"
        "def pytest_parallel_file_groups(path, items):\n"
        "    return ['db'] if 'db' in path.name else None\n"
        "def pytest_parallel_shard_worker(shard, num_workers):\n"
        "    return 1 if 'db' in shard.groups else None\n"
    )
    res = _run([str(tmp_path), "-j", "2", "--parallel-plan=json", "-q"], tmp_path)
    assert res.returncode == 0, res.stdout
    plan = _plan_json(res.stdout)
    assert plan["balance"] == "count"
    assert plan["num_workers"] == 2
    db_units = [u for w in plan["workers"] for u in w["units"] if "db" in u["groups"]]
    assert db_units
    assert all(u["worker"] == 1 and u["pinned"] for u in db_units)
    heavy = [
        u
        for w in plan["workers"]
        for u in w["units"]
        if any(Path(path).name == "test_heavy.py" for path in u["files"])
    ]
    assert heavy[0]["weight"] == 10.0


def test_conftest_hooks_stay_inside_their_directory(tmp_path: Path) -> None:
    nested = tmp_path / "nested"
    other = tmp_path / "other"
    nested.mkdir()
    other.mkdir()
    (nested / "test_nested.py").write_text("def test_nested():\n assert True\n")
    (other / "test_other.py").write_text("def test_other():\n assert True\n")
    (tmp_path / "conftest.py").write_text(
        "def pytest_parallel_file_groups(path, items):\n"
        "    return [f'root-{path.name}']\n"
        "def pytest_parallel_file_weight(path, items):\n"
        "    return None\n"
    )
    calls = tmp_path / "shard_calls.txt"
    (nested / "conftest.py").write_text(
        "from pathlib import Path\n"
        f"CALLS = Path({str(calls)!r})\n"
        "def pytest_parallel_file_groups(path, items):\n"
        "    return ['from-nested']\n"
        "def pytest_parallel_file_weight(path, items):\n"
        "    return 9.0\n"
        "def pytest_parallel_shard_worker(shard, num_workers):\n"
        "    with CALLS.open('a') as handle:\n"
        "        handle.write(','.join(path.as_posix() for path in shard.files) + '\\n')\n"
        "    return 0\n"
    )
    (tmp_path / "scope_plugin.py").write_text(
        "def pytest_parallel_file_groups(path, items):\n"
        "    return [f'plug-{path.name}']\n"
        "def pytest_parallel_shard_worker(shard, num_workers):\n"
        "    return None\n"
    )
    res = _run(
        [str(tmp_path), "-j", "2", "--parallel-plan=json", "-p", "scope_plugin", "-q"],
        tmp_path,
    )
    assert res.returncode == 0, res.stdout
    plan = _plan_json(res.stdout)
    units = [unit for worker in plan["workers"] for unit in worker["units"]]

    def unit_for(suffix: str) -> dict[str, Any]:
        matches = [
            unit for unit in units if any(str(path).endswith(suffix) for path in unit["files"])
        ]
        assert len(matches) == 1, units
        return matches[0]

    other_unit = unit_for("other/test_other.py")
    nested_unit = unit_for("nested/test_nested.py")
    assert "root-test_other.py" in other_unit["groups"]
    assert "plug-test_other.py" in other_unit["groups"]
    assert "from-nested" not in other_unit["groups"]
    assert other_unit["weight"] == 1
    assert other_unit["pinned"] is False
    assert "root-test_nested.py" in nested_unit["groups"]
    assert "plug-test_nested.py" in nested_unit["groups"]
    assert "from-nested" in nested_unit["groups"]
    assert nested_unit["weight"] == 9.0
    assert nested_unit["pinned"] is True
    assert nested_unit["worker"] == 0
    lines = calls.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 1
    assert lines[0].endswith("nested/test_nested.py")
    assert "test_other" not in lines[0]


def test_json_plan_stdout_is_one_document(tmp_path: Path) -> None:
    (tmp_path / "test_a.py").write_text("def test_a():\n assert True\n")
    (tmp_path / "test_b.py").write_text("def test_b():\n assert True\n")
    res = _run([str(tmp_path), "-j", "2", "--parallel-plan=json"], tmp_path, merge_output=False)
    assert res.returncode == 0, res.stderr
    plan = json.loads(res.stdout)
    assert plan["version"] == 1
    assert res.stdout == json.dumps(plan, indent=2, sort_keys=True) + "\n"
    assert "platform" not in res.stdout
    assert "collected" not in res.stdout
    assert "platform" in res.stderr
    assert "collected" in res.stderr


def test_json_plan_collection_error_is_nonzero(tmp_path: Path) -> None:
    (tmp_path / "test_bad.py").write_text("def test_bad(\n")
    res = _run([str(tmp_path), "-j", "2", "--parallel-plan=json"], tmp_path, merge_output=False)
    assert res.returncode != 0
    assert res.stdout.strip() == ""
    assert "platform" not in res.stdout
    assert "collected" not in res.stdout


def test_json_plan_empty_collection_exits_zero(tmp_path: Path) -> None:
    empty = tmp_path / "empty"
    empty.mkdir()
    res = _run([str(empty), "-j", "2", "--parallel-plan=json"], empty, merge_output=False)
    assert res.returncode == 0, res.stderr
    plan = json.loads(res.stdout)
    assert plan["version"] == 1
    assert plan["num_units"] == 0
    assert plan["num_workers"] == 0
    assert plan["workers"] == []
    assert res.stdout == json.dumps(plan, indent=2, sort_keys=True) + "\n"


def test_plan_text_runs_no_tests(tmp_path: Path) -> None:
    marker = tmp_path / "ran.txt"
    (tmp_path / "test_a.py").write_text(
        f"from pathlib import Path\ndef test_a():\n Path({str(marker)!r}).write_text('x')\n"
    )
    res = _run([str(tmp_path), "-j", "2", "--parallel-plan"], tmp_path)
    assert res.returncode == 0, res.stdout
    assert "pytest-parallel plan:" in res.stdout
    assert not marker.exists()
    res_json = _run([str(tmp_path), "-j", "2", "--parallel-plan=json"], tmp_path)
    plan = _plan_json(res_json.stdout)
    assert plan["workers"][0]["test_count"] >= 1
    bad = _run([str(tmp_path), "--serial", "--parallel-plan"], tmp_path)
    assert bad.returncode == int(pytest.ExitCode.USAGE_ERROR), bad.stdout


def test_invalid_and_conflicting_hooks_fail(tmp_path: Path) -> None:
    (tmp_path / "test_a.py").write_text("def test_a():\n assert True\n")
    (tmp_path / "test_b.py").write_text("def test_b():\n assert True\n")
    (tmp_path / "conftest.py").write_text(
        "def pytest_parallel_file_weight(path, items):\n return -1\n"
    )
    res = _run([str(tmp_path), "-j", "2", "-q"], tmp_path)
    assert res.returncode == int(pytest.ExitCode.USAGE_ERROR), res.stdout
    assert "pytest_parallel_file_weight" in res.stdout

    (tmp_path / "conftest.py").write_text(
        "def pytest_parallel_shard_worker(shard, num_workers):\n return 0\n"
        "def pytest_parallel_shard_worker2(shard, num_workers):\n return None\n"
    )
    (tmp_path / "other_conftest_plugin.py").write_text("")
    (tmp_path / "conftest.py").write_text(
        "import pytest\n"
        "class P1:\n"
        "    def pytest_parallel_shard_worker(self, shard, num_workers):\n return 0\n"
        "class P2:\n"
        "    def pytest_parallel_shard_worker(self, shard, num_workers):\n return 1\n"
        "def pytest_configure(config):\n"
        "    config.pluginmanager.register(P1(), 'p1')\n"
        "    config.pluginmanager.register(P2(), 'p2')\n"
    )
    res2 = _run([str(tmp_path), "-j", "2", "-q"], tmp_path)
    assert res2.returncode != 0, res2.stdout
    assert "conflicting" in res2.stdout.lower()


def test_custom_weights_and_groups_execute(tmp_path: Path) -> None:
    (tmp_path / "test_a.py").write_text("def test_a():\n assert True\n")
    (tmp_path / "test_b.py").write_text("def test_b():\n assert True\n")
    (tmp_path / "conftest.py").write_text(
        "def pytest_parallel_file_groups(path, items):\n return ['shared']\n"
        "def pytest_parallel_file_weight(path, items):\n return 2.5\n"
    )
    res = _run([str(tmp_path), "-j", "2", "-q"], tmp_path)
    assert res.returncode == 0, res.stdout
    assert "1 workers" in res.stdout
    assert "2 passed" in res.stdout


def test_basetemp_per_worker_concurrent(tmp_path: Path) -> None:
    base = tmp_path / "base"
    for idx in range(2):
        (tmp_path / f"test_tmp_{idx}.py").write_text(
            "import time\n"
            "def test_write(tmp_path):\n"
            "    (tmp_path / 'data.txt').write_text('ok')\n"
            "    time.sleep(0.2)\n"
            "    assert (tmp_path / 'data.txt').read_text() == 'ok'\n"
        )
    res = _run([str(tmp_path), "-j", "2", "-q", f"--basetemp={base}"], tmp_path)
    assert res.returncode == 0, res.stdout
    assert (base / "worker-0").exists()
    assert (base / "worker-1").exists()


def test_maxfail_drain_allows_teardown(tmp_path: Path) -> None:
    marker = tmp_path / "teardown.txt"
    started = tmp_path / "started.txt"
    (tmp_path / "test_fail.py").write_text(
        "import time\n"
        "from pathlib import Path\n"
        f"STARTED = Path({str(started)!r})\n"
        "def test_fail():\n"
        "    deadline = time.monotonic() + 10\n"
        "    while not STARTED.exists():\n"
        "        if time.monotonic() > deadline:\n"
        "            raise AssertionError('slow test did not start')\n"
        "        time.sleep(0.02)\n"
        "    assert False\n"
    )
    (tmp_path / "test_slow.py").write_text(
        "import time\n"
        "from pathlib import Path\n"
        "import pytest\n"
        f"STARTED = Path({str(started)!r})\n"
        "@pytest.fixture\n"
        "def fix():\n"
        "    yield\n"
        f"    Path({str(marker)!r}).write_text('teardown-done')\n"
        "def test_slow(fix):\n"
        "    STARTED.write_text('1')\n"
        "    time.sleep(0.8)\n"
        "    assert True\n"
    )
    start = time.monotonic()
    res = _run([str(tmp_path), "-j", "2", "--maxfail=1", "-q"], tmp_path)
    elapsed = time.monotonic() - start
    assert res.returncode == int(pytest.ExitCode.TESTS_FAILED), res.stdout
    assert marker.exists(), res.stdout
    assert elapsed < 20


def test_start_methods_smoke(tmp_path: Path) -> None:
    (tmp_path / "test_a.py").write_text(
        "def test_a():\n assert True\ndef test_b():\n assert True\n"
    )
    for method in ("spawn", "forkserver"):
        res = _run([str(tmp_path), "-j", "1", f"--parallel-start-method={method}", "-q"], tmp_path)
        assert res.returncode == 0, (method, res.stdout)
        assert "2 passed" in res.stdout


def test_collection_mismatch_spawn_and_forkserver(tmp_path: Path) -> None:
    (tmp_path / "test_mismatch.py").write_text(
        "import os, pytest\n"
        "IDS = ['worker'] if os.environ.get('_PYTEST_PARALLEL_WORKER') == '1' else ['parent']\n"
        "@pytest.mark.parametrize('v', IDS)\n"
        "def test_dyn(v):\n assert True\n"
    )
    for method in ("spawn", "forkserver"):
        res = _run([str(tmp_path), "-j", "1", f"--parallel-start-method={method}", "-q"], tmp_path)
        assert res.returncode != 0, (method, res.stdout)
        assert "mismatch" in res.stdout.lower()


def test_xdist_conflict_or_skip(tmp_path: Path) -> None:
    pytest.importorskip("xdist")
    (tmp_path / "test_a.py").write_text("def test_a():\n assert True\n")
    res = _run([str(tmp_path), "-n", "2", "-q"], tmp_path)
    assert res.returncode == int(pytest.ExitCode.USAGE_ERROR), res.stdout


def test_setup_plan_falls_back_to_serial(tmp_path: Path) -> None:
    (tmp_path / "test_a.py").write_text(
        "import pytest\n@pytest.fixture\ndef f():\n return 1\ndef test_a(f):\n assert f == 1\n"
    )
    res = _run([str(tmp_path), "--setup-plan", "-q"], tmp_path)
    assert "test_a" in res.stdout, res.stdout
