from __future__ import annotations

import os
import shlex
import signal
import subprocess
import sys
import time
from pathlib import Path
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import patch

import pytest

from pytest_parallel.coordinator import Coordinator
from pytest_parallel.network import network_blocked


def _clean_env() -> dict[str, str]:
    env = os.environ.copy()
    env.pop("_PYTEST_PARALLEL_WORKER", None)
    env.pop("_PYTEST_PARALLEL_WORKER_ENTRY", None)
    env.pop("PYTEST_PARALLEL_WORKER_ID", None)
    env["PYTEST_DISABLE_PLUGIN_AUTOLOAD"] = "1"
    env["PYTEST_PLUGINS"] = "pytest_parallel.plugin"
    return env


def _run(
    args: list[str],
    cwd: Path,
    extra_env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    env = _clean_env()
    if extra_env:
        env.update(extra_env)
    return subprocess.run(
        [sys.executable, "-m", "pytest", *args],
        cwd=cwd,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        env=env,
    )


def test_network_hot_path_caches_peer_and_still_blocks_external() -> None:
    import socket

    with network_blocked():
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            listener.listen()
            with socket.socket() as client:
                client.connect(listener.getsockname())
                peer, _ = listener.accept()
                with peer:
                    for _ in range(20):
                        client.sendall(b"ok")
                        assert peer.recv(2) == b"ok"
        with socket.socket() as client, pytest.raises(PermissionError, match="outside loopback"):
            client.connect(("192.0.2.1", 80))
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as client:
            client.connect(("127.0.0.1", 9))
            client.send(b"x")
            with pytest.raises(PermissionError, match="outside loopback"):
                client.sendto(b"x", ("192.0.2.1", 9))


@pytest.mark.enable_network
def test_network_guard_allows_only_active_live_server_endpoint() -> None:
    import socket

    host = "192.0.2.10"
    bound: dict[socket.socket, tuple[str, int]] = {}
    peers: dict[socket.socket, tuple[str, int]] = {}

    def bind(sock: socket.socket, address: tuple[str, int]) -> None:
        bound[sock] = (address[0], address[1] or 43210)

    def getsockname(sock: socket.socket) -> tuple[str, int]:
        return bound.get(sock, ("0.0.0.0", 0))

    def connect(sock: socket.socket, address: tuple[str, int]) -> None:
        peers[sock] = address

    def getpeername(sock: socket.socket) -> tuple[str, int]:
        return peers[sock]

    def accept(sock: socket.socket) -> tuple[socket.socket, tuple[str, int]]:
        peers[accepted] = (host, 43211)
        return accepted, peers[accepted]

    with (
        socket.socket() as server,
        socket.socket() as client,
        socket.socket() as accepted,
        patch.object(socket.socket, "bind", bind),
        patch.object(socket.socket, "getsockname", getsockname),
        patch.object(socket.socket, "connect", connect),
        patch.object(socket.socket, "getpeername", getpeername),
        patch.object(socket.socket, "listen", lambda sock, backlog=0: None),
        patch.object(socket.socket, "accept", accept),
        patch.object(socket.socket, "recv", lambda sock, size, flags=0: b"x"),
        patch.object(socket.socket, "sendall", lambda sock, data, flags=0: None),
    ):
        with network_blocked(live_server_host=host):
            assert socket.getaddrinfo(host, 0)
            with pytest.raises(PermissionError, match="outside loopback"):
                socket.getaddrinfo("outside.invalid", 0)
            server.bind(("0.0.0.0", 0))
            server.listen()
            peer, _ = server.accept()
            assert peer is accepted
            assert peer.recv(1) == b"x"
            client.connect((host, bound[server][1]))
            client.sendall(b"x")

            with socket.socket() as other, pytest.raises(PermissionError, match="outside loopback"):
                other.connect((host, 43211))
            server.close()
            with socket.socket() as late, pytest.raises(PermissionError, match="outside loopback"):
                late.connect((host, bound[server][1]))


def test_connected_unix_socket_sendmsg_is_allowed() -> None:
    import socket

    address = f"/tmp/pp-{os.getpid()}.sock"
    try:
        os.unlink(address)
    except OSError:
        pass
    try:
        with network_blocked(), socket.socket(socket.AF_UNIX) as listener:
            listener.bind(address)
            listener.listen(1)
            with socket.socket(socket.AF_UNIX) as client:
                client.connect(address)
                peer, _ = listener.accept()
                with peer:
                    client.sendmsg([b"ok"])
                    assert peer.recv(2) == b"ok"
    finally:
        try:
            os.unlink(address)
        except OSError:
            pass


def test_forwarded_args_preserves_plugin_option_value_matching_positional(tmp_path: Path) -> None:
    (tmp_path / "test_a.py").write_text("def test_a():\n assert True\n")
    (tmp_path / "conftest.py").write_text(
        "def pytest_addoption(parser):\n"
        "    parser.addoption('--cov-out', default=None)\n"
        "def pytest_configure(config):\n"
        "    assert config.option.cov_out == 'tests'\n"
    )
    (tmp_path / "tests").mkdir()
    (tmp_path / "tests" / "test_b.py").write_text("def test_b():\n assert True\n")
    res = _run(["tests", "--cov-out", "tests", "-j", "1", "-q"], tmp_path)
    assert res.returncode == 0, res.stdout
    assert "1 passed" in res.stdout


def test_coordinator_work_dir_is_created_under_explicit_basetemp(tmp_path: Path) -> None:
    base = tmp_path / "base"
    config = SimpleNamespace(option=SimpleNamespace(basetemp=str(base)), rootpath=tmp_path)
    work = Coordinator(cast(Any, config), 1)._ensure_work_dir()
    assert work.parent == base
    assert work.name.startswith("pytest_parallel_")


def test_work_dir_inside_explicit_basetemp(tmp_path: Path) -> None:
    base = tmp_path / "base"
    (tmp_path / "test_a.py").write_text(
        "def test_a(tmp_path):\n (tmp_path / 'x').write_text('1')\n assert True\n"
    )
    res = _run([str(tmp_path), "-j", "1", "-q", f"--basetemp={base}"], tmp_path)
    assert res.returncode == 0, res.stdout
    assert (base / "worker-0").exists()


def test_worker_native_fd_output_goes_to_worker_output(tmp_path: Path) -> None:
    (tmp_path / "test_native.py").write_text(
        "import os\ndef test_native():\n    os.write(1, b'NATIVE_FD_MARKER\\n')\n    assert True\n"
    )
    res = _run([str(tmp_path), "-j", "1", "-q", "-s"], tmp_path)
    assert res.returncode == 0, res.stdout
    assert "NATIVE_FD_MARKER" in res.stdout


def test_custom_warning_constructor_fallback(tmp_path: Path) -> None:
    (tmp_path / "test_warn.py").write_text(
        "import warnings\n"
        "class MultiArgWarning(UserWarning):\n"
        "    def __init__(self, code, msg):\n"
        "        super().__init__(msg)\n"
        "        self.code = code\n"
        "def test_warns():\n"
        "    warnings.warn(MultiArgWarning(7, 'multi-arg warning'))\n"
        "    assert True\n"
    )
    res = _run([str(tmp_path), "-j", "1", "-q"], tmp_path)
    assert res.returncode == 0, res.stdout
    assert "1 passed" in res.stdout


def test_sigterm_reaps_worker_and_removes_work_dir(tmp_path: Path) -> None:
    suite = tmp_path / "suite"
    suite.mkdir()
    scratch = tmp_path / "tmp"
    scratch.mkdir()
    ready = tmp_path / "ready.txt"
    pid_file = tmp_path / "worker_pid.txt"
    (suite / "test_hang.py").write_text(
        "import os, time\n"
        "from pathlib import Path\n"
        f"READY = Path({str(ready)!r})\n"
        f"PID = Path({str(pid_file)!r})\n"
        "def test_sleep():\n"
        "    if os.environ.get('_PYTEST_PARALLEL_WORKER') == '1':\n"
        "        PID.write_text(str(os.getpid()))\n"
        "        READY.write_text('1')\n"
        "        time.sleep(10.0)\n"
    )
    env = _clean_env()
    env["TMPDIR"] = str(scratch)
    proc = subprocess.Popen(
        [sys.executable, "-m", "pytest", str(suite), "-j", "1", "-q"],
        cwd=tmp_path,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        env=env,
    )
    deadline = time.monotonic() + 8.0
    while not ready.exists() and time.monotonic() < deadline:
        time.sleep(0.02)
    assert ready.exists(), (
        proc.communicate(timeout=1)[0] if proc.poll() is not None else "worker did not start"
    )
    proc.send_signal(signal.SIGTERM)
    stdout, _ = proc.communicate(timeout=8.0)
    assert proc.returncode != 0, stdout
    worker_pid = int(pid_file.read_text().strip())
    deadline = time.monotonic() + 2.0
    while time.monotonic() < deadline:
        try:
            os.kill(worker_pid, 0)
        except OSError:
            break
        time.sleep(0.02)
    else:
        raise AssertionError(f"worker {worker_pid} still alive")
    assert list(scratch.glob("pytest_parallel_*")) == []


def _worker_isolation_suite(root: Path, junit: Path) -> None:
    root.mkdir()
    (root / "markers").mkdir()
    for idx in (0, 1):
        (root / f"test_w{idx}.py").write_text(
            "import os\n"
            "from pathlib import Path\n"
            "def test_worker(request, tmp_path):\n"
            "    assert request.config.pluginmanager.get_plugin('cacheprovider') is not None\n"
            "    cache_dir = Path(str(request.config.getini('cache_dir')))\n"
            "    assert cache_dir.is_absolute()\n"
            "    assert cache_dir.name == 'pytest-cache'\n"
            "    assert cache_dir.parent in Path(str(tmp_path)).parents\n"
            f"    assert cache_dir != Path({str(root / '.pytest_cache')!r})\n"
            f"    assert not Path({str(junit)!r}).exists()\n"
            "    text = str(tmp_path)\n"
            "    assert 'worker-' in text\n"
            f"    Path({str(root / 'markers')!r}, os.environ['PYTEST_PARALLEL_WORKER_ID']).write_text(text)\n"
        )


def _assert_isolated_workers(
    root: Path, base: Path, junit: Path, result: subprocess.CompletedProcess[str]
) -> None:
    assert result.returncode == 0, result.stdout
    assert (base / "sentinel.txt").is_file()
    assert (base / "worker-0").is_dir()
    assert (base / "worker-1").is_dir()
    temps = {(root / "markers" / str(idx)).read_text() for idx in (0, 1)}
    assert len(temps) == 2
    assert all(Path(temp) != base and base in Path(temp).parents for temp in temps)
    assert junit.is_file()


def _quoted_addopts(cache_flag: str, junit: Path, base: Path) -> str:
    return " ".join(
        (
            cache_flag,
            f"--junitxml={shlex.quote(str(junit))}",
            f"--basetemp={shlex.quote(str(base))}",
        )
    )


def test_pytest_ini_addopts_do_not_leak_into_workers(tmp_path: Path) -> None:
    root = tmp_path / "suite"
    base = tmp_path / "base"
    base.mkdir()
    (base / "sentinel.txt").write_text("keep")
    junit = root / "shared-junit.xml"
    _worker_isolation_suite(root, junit)
    (root / "pytest.ini").write_text(
        f"[pytest]\naddopts = {_quoted_addopts('-pcacheprovider', junit, base)}\n"
    )
    result = _run([str(root), "-j", "2", "-q"], root)
    _assert_isolated_workers(root, base, junit, result)


def test_pyproject_addopts_do_not_leak_into_workers(tmp_path: Path) -> None:
    root = tmp_path / "suite"
    base = tmp_path / "base"
    base.mkdir()
    (base / "sentinel.txt").write_text("keep")
    junit = root / "shared-junit.xml"
    _worker_isolation_suite(root, junit)
    addopts = _quoted_addopts("-p cacheprovider", junit, base)
    (root / "pyproject.toml").write_text(f"[tool.pytest.ini_options]\naddopts = {addopts!r}\n")
    result = _run([str(root), "-j", "2", "-q"], root)
    _assert_isolated_workers(root, base, junit, result)


def test_pytest_addopts_do_not_leak_into_workers(tmp_path: Path) -> None:
    root = tmp_path / "suite"
    base = tmp_path / "base"
    base.mkdir()
    (base / "sentinel.txt").write_text("keep")
    junit = root / "shared-junit.xml"
    _worker_isolation_suite(root, junit)
    result = _run(
        [str(root), "-j", "2", "-q"],
        root,
        {"PYTEST_ADDOPTS": _quoted_addopts("-p cacheprovider", junit, base)},
    )
    _assert_isolated_workers(root, base, junit, result)


def test_ini_pyproject_and_pytest_addopts_are_sanitized_together(tmp_path: Path) -> None:
    root = tmp_path / "suite"
    base = tmp_path / "base"
    base.mkdir()
    (base / "sentinel.txt").write_text("keep")
    junit = root / "shared-junit.xml"
    _worker_isolation_suite(root, junit)
    (root / "pytest.ini").write_text(
        f"[pytest]\naddopts = {_quoted_addopts('-pcacheprovider', junit, base)}\n"
    )
    pyproject_addopts = _quoted_addopts("-p cacheprovider", junit, base)
    (root / "pyproject.toml").write_text(
        f"[tool.pytest.ini_options]\naddopts = {pyproject_addopts!r}\n"
    )
    result = _run(
        [str(root), "-j", "2", "-q"],
        root,
        {"PYTEST_ADDOPTS": _quoted_addopts("-p cacheprovider", junit, base)},
    )
    _assert_isolated_workers(root, base, junit, result)


def test_ini_log_file_is_per_worker(tmp_path: Path) -> None:
    root = tmp_path / "suite"
    root.mkdir()
    (root / "pytest.ini").write_text("[pytest]\nlog_file = shared.log\nlog_file_level = INFO\n")
    body = (
        "import logging\n"
        "import os\n"
        "def test_logs():\n"
        "    logging.getLogger('pytest_parallel_test').warning(\n"
        "        'PYTEST_PARALLEL_WORKER_ID=%s', os.environ['PYTEST_PARALLEL_WORKER_ID']\n"
        "    )\n"
    )
    (root / "test_a.py").write_text(body)
    (root / "test_b.py").write_text(body)
    result = _run([str(root), "-j", "2", "-q"], root)
    assert result.returncode == 0, result.stdout
    shared = (
        (root / "shared.log").read_text(encoding="utf-8") if (root / "shared.log").exists() else ""
    )
    assert "PYTEST_PARALLEL_WORKER_ID=" not in shared
    for worker_id in (0, 1):
        text = (root / f"shared.worker-{worker_id}.log").read_text(encoding="utf-8")
        assert f"PYTEST_PARALLEL_WORKER_ID={worker_id}" in text
