from __future__ import annotations

import importlib
import subprocess
import sys
from pathlib import Path

import pytest

# Module has hyphens in its name, so use importlib.
_mod = importlib.import_module("backend-test-services")

SCRIPTS = Path(__file__).parent


@pytest.mark.parametrize(
    ("selective", "snuba_shards", "instance", "color", "guard", "mode", "per_worker"),
    [
        ("true", "10", "20", "", "", "backend-ci", "1"),
        ("false", "0", "20", "", "record", "backend-ci", "1"),
        ("false", "10", "9", "snuba", "record", "backend-ci", "1"),
        ("false", "10", "10", "lite", "enforce", "backend-ci-lite", ""),
    ],
)
def test_pick_shard(
    selective: str,
    snuba_shards: str,
    instance: str,
    color: str,
    guard: str,
    mode: str,
    per_worker: str,
) -> None:
    env = {
        "SELECTIVE": selective,
        "BACKEND_SNUBA_SHARDS": snuba_shards,
        "MATRIX_INSTANCE": instance,
    }
    assert _mod.pick_shard(env) == {
        "BACKEND_TEST_SERVICE_COLOR": color,
        "BACKEND_TEST_SERVICE_GUARD": guard,
        "BACKEND_DEVSERVICES_MODE": mode,
        "XDIST_PER_WORKER_SNUBA": per_worker,
    }


def test_inventory_unions_every_workers_usage() -> None:
    usages = [
        {"mode": "record", "files": {"b.py": [], "split.py": []}},
        {"mode": "record", "files": {"a.py": ["snuba"], "split.py": ["kafka"]}},
        {"mode": "enforce", "files": {"c.py": []}},
    ]
    assert _mod.inventory(usages) == {
        "files": {"a.py": ["snuba"], "b.py": [], "c.py": [], "split.py": ["kafka"]}
    }


GUARDED_TESTS = """
import socket

import confluent_kafka
import confluent_kafka.admin


def test_swallowed_snuba_error():
    try:
        socket.create_connection(("127.0.0.1", 1218), timeout=1)
    except OSError:
        pass


def test_kafka_client():
    confluent_kafka.Producer({"bootstrap.servers": "127.0.0.1:9092"})


def test_kafka_admin_client():
    confluent_kafka.admin.AdminClient({"bootstrap.servers": "127.0.0.1:9092"})


def test_other_port():
    try:
        socket.create_connection(("127.0.0.1", 5432), timeout=1)
    except OSError:
        pass
"""


@pytest.mark.parametrize("mode", ["record", "enforce"])
def test_guard(tmp_path: Path, mode: str) -> None:
    (tmp_path / "test_guarded.py").write_text(GUARDED_TESTS)
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "-p", "no:cacheprovider", "-p", "pytest_service_guard"],
        cwd=tmp_path,
        env={"PYTHONPATH": str(SCRIPTS), "BACKEND_TEST_SERVICE_GUARD": mode, "PATH": ""},
        capture_output=True,
        text=True,
    )
    usage = (tmp_path / ".artifacts/service-usage/main.json").read_text()
    assert '"test_guarded.py": ["kafka", "snuba"]' in usage
    if mode == "record":
        assert result.returncode == 0, result.stdout
    else:
        assert result.returncode == 1, result.stdout
        assert "3 failed, 1 passed" in result.stdout
        assert "test_swallowed_snuba_error used snuba on a lite shard" in result.stdout
        assert "test_kafka_client used kafka on a lite shard" in result.stdout
        assert "test_kafka_admin_client used kafka on a lite shard" in result.stdout
