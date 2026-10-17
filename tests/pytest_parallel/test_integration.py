from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest


def _clean_env() -> dict[str, str]:
    env = os.environ.copy()
    env.pop("_PYTEST_PARALLEL_WORKER", None)
    env.pop("PYTEST_PARALLEL_WORKER_ID", None)
    return env


def test_jobs_option_runs_parallel_worker(tmp_path: Path) -> None:
    test_file = tmp_path / "test_sample.py"
    test_file.write_text("def test_ok():\n    assert True\n")

    result = subprocess.run(
        [sys.executable, "-m", "pytest", str(test_file), "-q", "-j", "1"],
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        env=_clean_env(),
    )

    assert result.returncode == 0
    assert "pytest-parallel: 1 workers, 1 tests" in result.stdout
    assert "1 passed" in result.stdout


def test_network_policy_and_loopback_exception(tmp_path: Path) -> None:
    runner_args = ("-j", "1")
    test_file = tmp_path / "test_network_policy.py"
    test_file.write_text(
        """
import socket

import pytest

ORIGINAL_CONNECT = socket.socket.connect


def test_external_connection_is_blocked():
    with socket.socket() as client:
        with pytest.raises(PermissionError, match='outside loopback'):
            client.connect(('192.0.2.1', 80))


def test_external_hostname_lookup_is_blocked():
    with pytest.raises(PermissionError, match='outside loopback'):
        socket.getaddrinfo('example.com', 80)


def test_loopback_connection_is_allowed():
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        listener.listen()
        with socket.socket() as client:
            client.connect(listener.getsockname())
            peer, _ = listener.accept()
            with peer:
                client.sendall(b'ok')
                assert peer.recv(2) == b'ok'


@pytest.mark.enable_network
def test_marker_allows_network():
    assert socket.socket.connect is ORIGINAL_CONNECT
"""
    )

    result = subprocess.run(
        [sys.executable, "-m", "pytest", str(test_file), "-q", *runner_args],
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        env=_clean_env(),
    )

    assert result.returncode == 0, result.stdout
    assert "4 passed" in result.stdout


def test_network_blocked_allows_local_bind_and_hostname() -> None:
    import socket

    from pytest_parallel.network import network_blocked

    with network_blocked():
        assert socket.getaddrinfo(None, 0, flags=socket.AI_PASSIVE)
        for host in ("", socket.gethostname()):
            try:
                socket.getaddrinfo(host, 0)
            except PermissionError:
                raise AssertionError(f"lookup of {host!r} must not be blocked") from None
            except OSError:
                pass
        with socket.socket() as listener:
            listener.bind(("0.0.0.0", 0))
            listener.listen()


def test_network_guard_accepts_empty_byte_hostname() -> None:
    result = subprocess.run(
        [
            sys.executable,
            "-bb",
            "-c",
            "import socket\n"
            "from pytest_parallel.network import network_blocked\n"
            "with network_blocked():\n"
            "    socket.getaddrinfo(b'', 0)\n",
        ],
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        cwd=Path(__file__).parents[2],
        env=_clean_env(),
    )

    assert result.returncode == 0, result.stdout


def test_serial_network_is_not_guarded(tmp_path: Path) -> None:
    test_file = tmp_path / "test_serial_net.py"
    test_file.write_text(
        "import socket\n"
        "ORIGINAL = socket.socket.connect\n"
        "def test_serial_keeps_socket_api():\n"
        "    assert socket.socket.connect is ORIGINAL\n"
        "    with socket.socket() as listener:\n"
        "        listener.bind(('127.0.0.1', 0))\n"
        "        listener.listen()\n"
        "        assert socket.getaddrinfo(None, 0, flags=socket.AI_PASSIVE)\n"
    )
    result = subprocess.run(
        [sys.executable, "-m", "pytest", str(test_file), "-q", "--serial"],
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        env=_clean_env(),
    )
    assert result.returncode == 0, result.stdout
    assert "1 passed" in result.stdout


def test_ramp_delays_first_test_after_collection(tmp_path: Path) -> None:
    for idx in range(2):
        stamp_file = tmp_path / f"worker_{idx}.json"
        (tmp_path / f"test_ramp_{idx}.py").write_text(
            "import json, os, time\n"
            "from pathlib import Path\n"
            "COLLECT_TS = time.monotonic()\n"
            f"STAMP = Path({str(stamp_file)!r})\n"
            "def test_first():\n"
            "    if os.environ.get('_PYTEST_PARALLEL_WORKER') == '1':\n"
            "        STAMP.write_text(json.dumps({'collect': COLLECT_TS, 'run': time.monotonic()}))\n"
            "def test_second():\n"
            "    assert True\n"
        )

    result = subprocess.run(
        [sys.executable, "-m", "pytest", str(tmp_path), "-j", "2", "--ramp=0.25s", "-q"],
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        env=_clean_env(),
    )
    assert result.returncode == 0, result.stdout
    w0 = json.loads((tmp_path / "worker_0.json").read_text())
    w1 = json.loads((tmp_path / "worker_1.json").read_text())
    assert (w1["run"] - w1["collect"]) >= 0.18
    assert (w1["run"] - w0["run"]) >= 0.12


def test_parallel_group_affinity_and_special_nodeids(tmp_path: Path) -> None:
    records_dir = tmp_path / "records"
    records_dir.mkdir()

    (tmp_path / "test_a.py").write_text(
        "import json, os, pytest\n"
        "from pathlib import Path\n"
        f"OUT = Path({str(records_dir / 'a.json')!r})\n"
        "pytestmark = pytest.mark.parallel_group('shared_db')\n"
        "@pytest.mark.parametrize('param', ['user@host::port', '日本語::テスト@1'])\n"
        "def test_grouped_a(request, param):\n"
        "    OUT.write_text(json.dumps({'wid': os.environ['PYTEST_PARALLEL_WORKER_ID'], 'nodeid': request.node.nodeid}))\n"
    )
    (tmp_path / "test_b.py").write_text(
        "import json, os\n"
        "from pathlib import Path\n"
        f"OUT = Path({str(records_dir / 'b.json')!r})\n"
        "def test_ungrouped_b():\n"
        "    OUT.write_text(json.dumps({'wid': os.environ['PYTEST_PARALLEL_WORKER_ID']}))\n"
    )
    (tmp_path / "test_c.py").write_text(
        "import json, os, pytest\n"
        "from pathlib import Path\n"
        f"OUT = Path({str(records_dir / 'c.json')!r})\n"
        "@pytest.mark.parametrize('x', [pytest.param(1, marks=pytest.mark.parallel_group('shared_db'))])\n"
        "def test_grouped_c(request, x):\n"
        "    OUT.write_text(json.dumps({'wid': os.environ['PYTEST_PARALLEL_WORKER_ID'], 'nodeid': request.node.nodeid}))\n"
    )

    result = subprocess.run(
        [sys.executable, "-m", "pytest", str(tmp_path), "-j", "2", "-q"],
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        env=_clean_env(),
    )
    assert result.returncode == 0, result.stdout
    rec_a = json.loads((records_dir / "a.json").read_text())
    rec_b = json.loads((records_dir / "b.json").read_text())
    rec_c = json.loads((records_dir / "c.json").read_text())
    assert rec_a["wid"] == rec_c["wid"]
    assert rec_a["wid"] != rec_b["wid"]
    assert "shared_db" not in rec_a["nodeid"]
    assert "shared_db" not in rec_c["nodeid"]


def test_uncaptured_output_s_flag_and_terminal_dimensions(tmp_path: Path) -> None:
    test_file = tmp_path / "test_output.py"
    test_file.write_text(
        "import os\n"
        "def test_prints_and_columns():\n"
        "    print('LIVE_STDOUT_MARKER_123')\n"
        "    assert int(os.environ.get('COLUMNS', '0')) > 0\n"
    )
    env = _clean_env()
    env["COLUMNS"] = "132"

    result = subprocess.run(
        [sys.executable, "-m", "pytest", str(test_file), "-j", "1", "-s", "-q"],
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        env=env,
    )
    assert result.returncode == 0, result.stdout
    assert "LIVE_STDOUT_MARKER_123" in result.stdout


@pytest.mark.parametrize("workers", ["1", "2"])
def test_warnings_forwarded_without_duplicating_collection_warnings(
    tmp_path: Path, workers: str
) -> None:
    (tmp_path / "test_warn_a.py").write_text(
        "import warnings\n"
        "warnings.warn('collection_time_warning_once', UserWarning)\n"
        "def test_runtime_warn_a():\n"
        "    warnings.warn('runtime_warning_alpha', UserWarning)\n"
    )
    (tmp_path / "test_warn_b.py").write_text(
        "import warnings\n"
        "def test_runtime_warn_b():\n"
        "    warnings.warn('runtime_warning_beta', DeprecationWarning)\n"
    )

    result = subprocess.run(
        [sys.executable, "-m", "pytest", str(tmp_path), "-j", workers],
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        env=_clean_env(),
    )
    assert result.returncode == 0, result.stdout
    assert "runtime_warning_alpha" in result.stdout
    assert "runtime_warning_beta" in result.stdout
    assert result.stdout.count("UserWarning: collection_time_warning_once") == 1
    assert "2 passed, 3 warnings" in result.stdout
