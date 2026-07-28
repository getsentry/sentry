from __future__ import annotations

import getpass
import os
from collections.abc import Generator, Sequence
from contextlib import contextmanager
from pathlib import Path
from unittest import mock

import psutil
import pytest

from sentry.runner.commands.devserver import (
    _daemon_matches,
    _find_orphaned_daemons,
    _reap_orphaned_daemons,
)

CWD = "/repo/sentry"
# Use the real user so the same-user guard can be exercised without patching
# anything on the shared psutil module -- tests/conftest.py calls
# psutil.Process() itself for an open-files leak check.
USER = getpass.getuser()

CONSUMER_CMD = [
    "sentry",
    "run",
    "consumer",
    "getsentry-outcomes",
    "--consumer-group=sentry-consumer",
    "--auto-offset-reset=latest",
    "--no-strict-offset-reset",
]
CONSUMER_ARGV = [
    "/repo/sentry/.venv/bin/python3",
    "/repo/sentry/.venv/bin/sentry",
    *CONSUMER_CMD[1:],
]

SERVER_CMD = ["sentry", "run", "web"]
WATCHER_CMD = [
    "/repo/sentry/node_modules/.bin/rspack",
    "serve",
    "--config=/repo/sentry/rspack.config.ts",
]


class FakeProcess:
    def __init__(
        self,
        pid: int,
        ppid: int,
        cmdline: Sequence[str],
        cwd: str = CWD,
        username: str = USER,
        cwd_exc: BaseException | None = None,
        children: Sequence[FakeProcess] = (),
    ) -> None:
        self.pid = pid
        self._ppid = ppid
        self._cmdline = list(cmdline)
        self._username = username
        self._cwd = cwd
        self._cwd_exc = cwd_exc
        self._children = list(children)
        self.terminated = False
        self.killed = False

    def ppid(self) -> int:
        return self._ppid

    def cmdline(self) -> list[str]:
        return list(self._cmdline)

    def username(self) -> str:
        return self._username

    def cwd(self) -> str:
        if self._cwd_exc is not None:
            raise self._cwd_exc
        return self._cwd

    def children(self, recursive: bool = False) -> list[FakeProcess]:
        return list(self._children)

    def terminate(self) -> None:
        self.terminated = True

    def kill(self) -> None:
        self.killed = True


@contextmanager
def process_table(procs: Sequence[FakeProcess]) -> Generator[None]:
    """Drive the reaper against an explicit process table."""
    with mock.patch(
        "sentry.runner.commands.devserver.psutil.process_iter",
        side_effect=lambda *a, **kw: iter(list(procs)),
    ):
        yield


@contextmanager
def sigterm_works(honored: bool) -> Generator[mock.MagicMock]:
    """Stub wait_procs to report whether SIGTERM actually reaped the victims."""

    def _wait(
        procs: Sequence[FakeProcess], timeout: float | None = None
    ) -> tuple[list[FakeProcess], list[FakeProcess]]:
        return (list(procs), []) if honored else ([], list(procs))

    with mock.patch(
        "sentry.runner.commands.devserver.psutil.wait_procs", side_effect=_wait
    ) as waited:
        yield waited


class TestDaemonMatches:
    def test_matches_through_interpreter_indirection(self) -> None:
        assert _daemon_matches(CONSUMER_ARGV, CONSUMER_CMD)

    def test_matches_bare_executable(self) -> None:
        assert _daemon_matches(["/repo/sentry/.venv/bin/sentry", "run", "web"], SERVER_CMD)

    def test_matches_node_watcher(self) -> None:
        assert _daemon_matches(["node", *WATCHER_CMD], WATCHER_CMD)

    def test_different_consumer_does_not_match(self) -> None:
        argv = [
            "/repo/sentry/.venv/bin/python3",
            "/repo/sentry/.venv/bin/sentry",
            "run",
            "consumer",
            "ingest-events",
            "--consumer-group=sentry-consumer",
            "--auto-offset-reset=latest",
            "--no-strict-offset-reset",
        ]
        assert not _daemon_matches(argv, CONSUMER_CMD)

    def test_extra_trailing_args_do_not_match(self) -> None:
        """The daemon's args must be the exact trailing portion, not a prefix."""
        argv = [
            "/repo/sentry/.venv/bin/python3",
            "/repo/sentry/.venv/bin/sentry",
            "run",
            "web",
            "-x",
        ]
        assert not _daemon_matches(argv, SERVER_CMD)

    def test_wrong_executable_does_not_match(self) -> None:
        argv = ["/repo/sentry/.venv/bin/python3", "/usr/bin/other", "run", "web"]
        assert not _daemon_matches(argv, SERVER_CMD)

    def test_args_without_preceding_executable_do_not_match(self) -> None:
        assert not _daemon_matches(["run", "web"], SERVER_CMD)

    def test_empty_argv(self) -> None:
        assert not _daemon_matches([], SERVER_CMD)

    def test_single_element_command(self) -> None:
        assert _daemon_matches(["/usr/local/bin/taskbroker"], ["taskbroker"])
        assert not _daemon_matches(["/usr/local/bin/other"], ["taskbroker"])


class TestFindOrphanedDaemons:
    daemons: list[tuple[str, Sequence[str]]] = [
        ("getsentry-outcomes", CONSUMER_CMD),
        ("server", SERVER_CMD),
    ]

    def test_finds_orphan(self) -> None:
        with process_table([FakeProcess(100, 1, CONSUMER_ARGV)]):
            found = _find_orphaned_daemons(self.daemons, CWD)

        assert [(name, p.pid) for name, p in found] == [("getsentry-outcomes", 100)]

    def test_ignores_live_child_of_running_devserver(self) -> None:
        """The critical guard: an identical cmdline still owned by honcho is left alone."""
        with process_table([FakeProcess(100, 55, CONSUMER_ARGV)]):
            assert _find_orphaned_daemons(self.daemons, CWD) == []

    def test_ignores_other_checkout(self) -> None:
        with process_table([FakeProcess(100, 1, CONSUMER_ARGV, cwd="/repo/sentry-other")]):
            assert _find_orphaned_daemons(self.daemons, CWD) == []

    def test_ignores_daemon_not_being_started(self) -> None:
        with process_table([FakeProcess(100, 1, CONSUMER_ARGV)]):
            assert _find_orphaned_daemons([("server", SERVER_CMD)], CWD) == []

    def test_ignores_other_user(self) -> None:
        with process_table([FakeProcess(100, 1, CONSUMER_ARGV, username="someone-else")]):
            assert _find_orphaned_daemons(self.daemons, CWD) == []

    def test_ignores_own_pid(self) -> None:
        with process_table([FakeProcess(os.getpid(), 1, CONSUMER_ARGV)]):
            assert _find_orphaned_daemons(self.daemons, CWD) == []

    def test_ignores_empty_cmdline(self) -> None:
        with process_table([FakeProcess(100, 1, [])]):
            assert _find_orphaned_daemons(self.daemons, CWD) == []

    @pytest.mark.parametrize("exc", [psutil.NoSuchProcess(100), psutil.AccessDenied(100)])
    def test_cwd_errors_do_not_propagate(self, exc: BaseException) -> None:
        """A process exiting or denying access mid-scan must not abort startup."""
        with process_table([FakeProcess(100, 1, CONSUMER_ARGV, cwd_exc=exc)]):
            assert _find_orphaned_daemons(self.daemons, CWD) == []

    def test_resolves_symlinked_cwd(self, tmp_path: Path) -> None:
        """
        psutil reports a resolved cwd (macOS gives /private/tmp for /tmp), so both
        sides need realpath or the reaper silently matches nothing.
        """
        real = tmp_path / "checkout"
        real.mkdir()
        link = tmp_path / "link"
        link.symlink_to(real)

        with process_table([FakeProcess(100, 1, CONSUMER_ARGV, cwd=str(real))]):
            found = _find_orphaned_daemons(self.daemons, str(link))

        assert [p.pid for _, p in found] == [100]


class TestReapOrphanedDaemons:
    daemons: list[tuple[str, Sequence[str]]] = [("getsentry-outcomes", CONSUMER_CMD)]

    def test_terminates_orphan_and_children(self) -> None:
        child = FakeProcess(101, 100, CONSUMER_ARGV)
        orphan = FakeProcess(100, 1, CONSUMER_ARGV, children=[child])

        with process_table([orphan]), sigterm_works(True):
            _reap_orphaned_daemons(self.daemons, CWD)

        assert orphan.terminated and child.terminated
        assert not orphan.killed and not child.killed

    def test_escalates_to_kill_when_sigterm_ignored(self) -> None:
        """Wedged consumers do not honor SIGTERM, so the SIGKILL escalation matters."""
        orphan = FakeProcess(100, 1, CONSUMER_ARGV)

        with process_table([orphan]), sigterm_works(False):
            _reap_orphaned_daemons(self.daemons, CWD)

        assert orphan.terminated and orphan.killed

    def test_no_orphans_is_a_noop(self) -> None:
        with process_table([FakeProcess(100, 55, CONSUMER_ARGV)]), sigterm_works(True) as waited:
            _reap_orphaned_daemons(self.daemons, CWD)

        assert not waited.called
