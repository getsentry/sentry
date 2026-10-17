from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest


def _child_env() -> dict[str, str]:
    env = os.environ.copy()
    for name in (
        "_PYTEST_PARALLEL_WORKER",
        "_PYTEST_PARALLEL_WORKER_ENTRY",
        "PYTEST_PARALLEL_WORKER_ID",
        "PYTEST_PARALLEL_WORKER_COUNT",
        "PYTEST_PARALLEL_RUN_ID",
        "PYTEST_PARALLEL_COLLECTION_SEED",
        "PYTEST_ADDOPTS",
    ):
        env.pop(name, None)
    return env


def _run(
    args: list[str],
    cwd: Path,
    env: dict[str, str] | None = None,
    *,
    timeout: float = 30,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", "pytest", *args],
        cwd=cwd,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        env=env if env is not None else _child_env(),
        timeout=timeout,
    )


def _write_identity_conftest(suite: Path, out: Path, extra: str = "") -> None:
    suite.mkdir(parents=True, exist_ok=True)
    out.mkdir(parents=True, exist_ok=True)
    (suite / "conftest.py").write_text(
        "import json\n"
        "import os\n"
        "from pathlib import Path\n"
        "from pytest_parallel.api import current_run, current_worker\n"
        f"OUT = Path({str(out)!r})\n"
        "run = current_run()\n"
        "worker = current_worker()\n"
        "name = 'parent' if worker is None else f'worker-{worker.index}'\n"
        "payload = {\n"
        "    'role': None if run is None else run.role,\n"
        "    'run_id': None if run is None else run.run_id,\n"
        "    'collection_seed': None if run is None else run.collection_seed,\n"
        "    'worker_index': None if worker is None else worker.index,\n"
        "    'worker_count': None if worker is None else worker.count,\n"
        "    'env_run_id': os.environ.get('PYTEST_PARALLEL_RUN_ID'),\n"
        "    'env_worker_id': os.environ.get('PYTEST_PARALLEL_WORKER_ID'),\n"
        "    'env_worker_count': os.environ.get('PYTEST_PARALLEL_WORKER_COUNT'),\n"
        "    'env_entry': os.environ.get('_PYTEST_PARALLEL_WORKER_ENTRY'),\n"
        "}\n"
        "(OUT / (name + '.json')).write_text(json.dumps(payload))\n" + extra
    )


def _load_record(path: Path) -> dict[str, object]:
    return json.loads(path.read_text(encoding="utf-8"))


def _body_marker(root: Path) -> Path:
    marker = root / "ran.txt"
    root.mkdir(parents=True, exist_ok=True)
    (root / "test_body.py").write_text(
        "from pathlib import Path\n"
        f"def test_body():\n    Path({str(marker)!r}).write_text('ran')\n"
    )
    return marker


def _assert_usage_without_body(result: subprocess.CompletedProcess[str], marker: Path) -> None:
    assert result.returncode == int(pytest.ExitCode.USAGE_ERROR), result.stdout
    assert not marker.exists(), result.stdout


def test_importing_api_does_not_publish_a_run() -> None:
    script = (
        "import os\n"
        "from pytest_parallel.api import current_run, current_worker\n"
        "assert current_run() is None\n"
        "assert current_worker() is None\n"
        "assert 'PYTEST_PARALLEL_RUN_ID' not in os.environ\n"
    )
    result = subprocess.run(
        [sys.executable, "-c", script],
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        env=_child_env(),
    )
    assert result.returncode == 0, result.stdout


def test_spawn_conftest_sees_worker_index_and_shared_run_id(tmp_path: Path) -> None:
    suite = tmp_path / "suite"
    out = tmp_path / "out"
    _write_identity_conftest(suite, out)
    (suite / "test_a.py").write_text("def test_a():\n    assert True\n")
    (suite / "test_b.py").write_text("def test_b():\n    assert True\n")
    result = _run(
        [str(suite), "-j", "2", "--parallel-start-method=spawn", "-q"],
        suite,
    )
    assert result.returncode == 0, result.stdout
    parent = _load_record(out / "parent.json")
    assert parent["role"] == "controller"
    assert parent["worker_index"] is None
    assert parent["env_worker_id"] is None
    assert parent["env_worker_count"] is None
    assert parent["env_entry"] is None
    assert parent["collection_seed"] is None
    assert parent["run_id"]
    assert parent["env_run_id"] == parent["run_id"]
    workers = [_load_record(path) for path in sorted(out.glob("worker-*.json"))]
    assert [item["worker_index"] for item in workers] == [0, 1]
    assert {item["role"] for item in workers} == {"worker"}
    assert {item["run_id"] for item in workers} == {parent["run_id"]}
    assert {item["env_run_id"] for item in workers} == {parent["run_id"]}
    assert {item["worker_count"] for item in workers} == {2}
    assert {item["env_entry"] for item in workers} == {"1"}


def test_serial_has_no_worker_identity(tmp_path: Path) -> None:
    suite = tmp_path / "suite"
    out = tmp_path / "out"
    _write_identity_conftest(suite, out)
    (suite / "test_serial.py").write_text(
        "import os\n"
        "from pytest_parallel.api import current_run, current_worker\n"
        "def test_serial():\n"
        "    run = current_run()\n"
        "    assert run is not None\n"
        "    assert run.role == 'serial'\n"
        "    assert current_worker() is None\n"
        "    assert 'PYTEST_PARALLEL_WORKER_ID' not in os.environ\n"
        "    assert 'PYTEST_PARALLEL_WORKER_COUNT' not in os.environ\n"
    )
    result = _run([str(suite), "--serial", "-q"], suite)
    assert result.returncode == 0, result.stdout
    parent = _load_record(out / "parent.json")
    assert parent["role"] == "serial"
    assert parent["worker_index"] is None
    assert parent["env_worker_id"] is None
    assert list(out.glob("worker-*.json")) == []


def test_user_run_id_is_copied_unchanged(tmp_path: Path) -> None:
    suite = tmp_path / "suite"
    out = tmp_path / "out"
    _write_identity_conftest(suite, out)
    (suite / "test_a.py").write_text("def test_a():\n    assert True\n")
    (suite / "test_b.py").write_text("def test_b():\n    assert True\n")
    env = _child_env()
    env["PYTEST_PARALLEL_RUN_ID"] = "user-supplied-run"
    result = _run([str(suite), "-j", "2", "--parallel-start-method=spawn", "-q"], suite, env)
    assert result.returncode == 0, result.stdout
    parent = _load_record(out / "parent.json")
    workers = [_load_record(path) for path in sorted(out.glob("worker-*.json"))]
    assert parent["role"] == "controller"
    assert parent["run_id"] == "user-supplied-run"
    assert parent["env_run_id"] == "user-supplied-run"
    assert workers
    assert {item["run_id"] for item in workers} == {"user-supplied-run"}
    assert {item["env_run_id"] for item in workers} == {"user-supplied-run"}


def test_collection_seed_is_visible_on_controller(tmp_path: Path) -> None:
    suite = tmp_path / "suite"
    out = tmp_path / "out"
    _write_identity_conftest(suite, out)
    (suite / "test_seed.py").write_text("def test_seed():\n    assert True\n")
    env = _child_env()
    env["PYTEST_PARALLEL_COLLECTION_SEED"] = "17"
    result = _run([str(suite), "-j", "1", "-q"], suite, env)
    assert result.returncode == 0, result.stdout
    parent = _load_record(out / "parent.json")
    assert parent["role"] == "controller"
    assert parent["collection_seed"] == 17


def test_invalid_collection_seed_is_usage_error(tmp_path: Path) -> None:
    marker = _body_marker(tmp_path)
    env = _child_env()
    env["PYTEST_PARALLEL_COLLECTION_SEED"] = "nope"
    result = _run([str(tmp_path), "-j", "1", "-q"], tmp_path, env)
    _assert_usage_without_body(result, marker)


def test_empty_run_id_is_usage_error(tmp_path: Path) -> None:
    marker = _body_marker(tmp_path)
    env = _child_env()
    env["PYTEST_PARALLEL_RUN_ID"] = ""
    result = _run([str(tmp_path), "-j", "1", "-q"], tmp_path, env)
    _assert_usage_without_body(result, marker)


def test_unpinned_middle_bucket_keeps_its_index(tmp_path: Path) -> None:
    suite = tmp_path / "suite"
    out = tmp_path / "out"
    _write_identity_conftest(
        suite,
        out,
        "def pytest_parallel_shard_worker(shard, num_workers):\n"
        "    names = {path.name for path in shard.files}\n"
        "    if 'test_c.py' in names:\n"
        "        return 2\n"
        "    return 0\n",
    )
    for name in ("test_a.py", "test_b.py", "test_c.py"):
        (suite / name).write_text("def test_item():\n    assert True\n")
    result = _run([str(suite), "-j", "3", "--parallel-start-method=spawn", "-q"], suite)
    assert result.returncode == 0, result.stdout
    assert not (out / "worker-1.json").exists()
    left = _load_record(out / "worker-0.json")
    right = _load_record(out / "worker-2.json")
    parent = _load_record(out / "parent.json")
    assert parent["role"] == "controller"
    assert parent["worker_index"] is None
    assert left["worker_index"] == 0
    assert right["worker_index"] == 2
    assert left["worker_count"] == 3
    assert right["worker_count"] == 3
    assert left["role"] == "worker"
    assert right["role"] == "worker"
    assert left["run_id"] == parent["run_id"] == right["run_id"]


def test_plan_json_omits_run_identity(tmp_path: Path) -> None:
    suite = tmp_path / "suite"
    suite.mkdir()
    (suite / "test_a.py").write_text("def test_a():\n    assert True\n")
    (suite / "test_b.py").write_text("def test_b():\n    assert True\n")
    env = _child_env()
    env["PYTEST_PARALLEL_RUN_ID"] = "plan-run"
    env["PYTEST_PARALLEL_COLLECTION_SEED"] = "17"
    result = subprocess.run(
        [sys.executable, "-m", "pytest", str(suite), "-j", "2", "--parallel-plan=json", "-q"],
        cwd=suite,
        check=False,
        text=True,
        capture_output=True,
        env=env,
        timeout=30,
    )
    assert result.returncode == 0, result.stderr
    plan = json.loads(result.stdout)
    assert plan["version"] == 1
    assert _identity_fields(plan) == []


def test_leaked_worker_marker_is_usage_error(tmp_path: Path) -> None:
    marker = _body_marker(tmp_path)
    env = _child_env()
    env["_PYTEST_PARALLEL_WORKER"] = "1"
    result = _run([str(tmp_path), "-q"], tmp_path, env)
    _assert_usage_without_body(result, marker)


def test_default_network_blocks_non_loopback_connect(tmp_path: Path) -> None:
    (tmp_path / "test_net.py").write_text(
        "import socket\n"
        "import pytest\n"
        "def test_connect():\n"
        "    with socket.socket() as client:\n"
        "        with pytest.raises(PermissionError, match='outside loopback'):\n"
        "            client.connect(('192.0.2.1', 80))\n"
    )
    result = _run([str(tmp_path), "-j", "1", "-q"], tmp_path)
    assert result.returncode == 0, result.stdout


def test_inherit_network_does_not_install_guard(tmp_path: Path) -> None:
    (tmp_path / "test_net.py").write_text(
        "import socket\n"
        "def test_connect():\n"
        "    client = socket.socket()\n"
        "    client.settimeout(0.2)\n"
        "    try:\n"
        "        try:\n"
        "            client.connect(('192.0.2.1', 80))\n"
        "        except PermissionError as exc:\n"
        "            if 'outside loopback' in str(exc):\n"
        "                raise\n"
        "        except OSError:\n"
        "            return\n"
        "    finally:\n"
        "        client.close()\n"
    )
    result = _run([str(tmp_path), "-j", "1", "--parallel-network=inherit", "-q"], tmp_path)
    assert result.returncode == 0, result.stdout


def test_serial_network_is_not_guarded(tmp_path: Path) -> None:
    (tmp_path / "test_net.py").write_text(
        "import socket\n"
        "def test_connect():\n"
        "    client = socket.socket()\n"
        "    client.settimeout(0.2)\n"
        "    try:\n"
        "        try:\n"
        "            client.connect(('192.0.2.1', 80))\n"
        "        except PermissionError as exc:\n"
        "            if 'outside loopback' in str(exc):\n"
        "                raise\n"
        "        except OSError:\n"
        "            return\n"
        "    finally:\n"
        "        client.close()\n"
    )
    result = _run([str(tmp_path), "--serial", "-q"], tmp_path)
    assert result.returncode == 0, result.stdout


def test_invalid_network_is_usage_error(tmp_path: Path) -> None:
    marker = _body_marker(tmp_path)
    result = _run([str(tmp_path), "--parallel-network=wide", "-q"], tmp_path)
    _assert_usage_without_body(result, marker)


def _drain_suite(root: Path) -> tuple[Path, Path]:
    started = root / "teardown-started.txt"
    done = root / "teardown-done.txt"
    (root / "test_fail.py").write_text(
        "import time\n"
        "from pathlib import Path\n"
        f"STARTED = Path({str(started)!r})\n"
        "def test_fail():\n"
        "    deadline = time.monotonic() + 5\n"
        "    while not STARTED.exists():\n"
        "        if time.monotonic() > deadline:\n"
        "            raise AssertionError('teardown did not start')\n"
        "        time.sleep(0.01)\n"
        "    assert False\n"
    )
    (root / "test_slow.py").write_text(
        "import time\n"
        "from pathlib import Path\n"
        "import pytest\n"
        f"STARTED = Path({str(started)!r})\n"
        f"DONE = Path({str(done)!r})\n"
        "@pytest.fixture\n"
        "def hold():\n"
        "    yield\n"
        "    STARTED.write_text('1')\n"
        "    time.sleep(0.45)\n"
        "    DONE.write_text('1')\n"
        "def test_slow(hold):\n"
        "    assert True\n"
    )
    return started, done


def test_zero_drain_does_not_finish_inflight_teardown(tmp_path: Path) -> None:
    started, done = _drain_suite(tmp_path)
    result = _run([str(tmp_path), "-j", "2", "-x", "--parallel-drain=0", "-q"], tmp_path, timeout=20)
    assert result.returncode != 0, result.stdout
    assert started.exists(), result.stdout
    assert not done.exists(), result.stdout


def test_one_second_drain_finishes_short_teardown(tmp_path: Path) -> None:
    _started, done = _drain_suite(tmp_path)
    result = _run([str(tmp_path), "-j", "2", "-x", "--parallel-drain=1s", "-q"], tmp_path, timeout=20)
    assert result.returncode != 0, result.stdout
    assert done.exists(), result.stdout


def _identity_fields(value: object) -> list[str]:
    found: list[str] = []
    if isinstance(value, dict):
        for key, item in value.items():
            if key in {"run_id", "collection_seed"}:
                found.append(str(key))
            found.extend(_identity_fields(item))
    elif isinstance(value, list):
        for item in value:
            found.extend(_identity_fields(item))
    return found
