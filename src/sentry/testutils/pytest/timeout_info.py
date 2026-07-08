import os
import signal
import sys
import time

import pytest

_in_flight: dict[str, float] = {}
_original_stdout_fd: int | None = None


def _on_sigterm(signum, frame):
    msg_parts = []
    if _in_flight:
        msg_parts.append(f"\n\n{'=' * 60}")
        msg_parts.append("SIGTERM received — tests still in progress:")
        now = time.monotonic()
        for nodeid, start in sorted(_in_flight.items(), key=lambda x: x[1]):
            elapsed = now - start
            msg_parts.append(f"  [{elapsed:.1f}s] {nodeid}")
        msg_parts.append(f"{'=' * 60}\n")
    msg = "\n".join(msg_parts)
    fd = _original_stdout_fd if _original_stdout_fd is not None else 1
    try:
        os.write(fd, msg.encode())
    except Exception:
        pass
    os._exit(1)


def pytest_configure(config):
    global _original_stdout_fd
    _original_stdout_fd = os.dup(sys.stdout.fileno())
    signal.signal(signal.SIGTERM, _on_sigterm)


@pytest.hookimpl(trylast=True)
def pytest_runtest_logstart(nodeid, location):
    _in_flight[nodeid] = time.monotonic()


@pytest.hookimpl(trylast=True)
def pytest_runtest_logreport(report):
    if report.when == "teardown":
        _in_flight.pop(report.nodeid, None)
