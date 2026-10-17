from __future__ import annotations

import math
import os
import re
import sys
import uuid
from collections.abc import Generator
from importlib.util import find_spec
from typing import Literal

import pytest

from .api import WorkerInfo

__version__ = "0.2.0"

_DEFAULT_MAX_WORKERS = 64
_DEFAULT_DRAIN_SECONDS = 5.0
_RAMP_PATTERN = re.compile(
    r"^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[+-]?(?:inf|infinity|nan))\s*([smhSMH]?)$"
)
_DECIMAL_PATTERN = re.compile(r"-?\d+")
_RUN_ID_ENV = "PYTEST_PARALLEL_RUN_ID"
_COLLECTION_SEED_ENV = "PYTEST_PARALLEL_COLLECTION_SEED"
_WORKER_ID_ENV = "PYTEST_PARALLEL_WORKER_ID"
_WORKER_COUNT_ENV = "PYTEST_PARALLEL_WORKER_COUNT"
_WORKER_MARKER_ENV = "_PYTEST_PARALLEL_WORKER"
_WORKER_ENTRY_ENV = "_PYTEST_PARALLEL_WORKER_ENTRY"

BalanceStrategy = Literal["round-robin", "count"]
CollectionMode = Literal["nodeid", "manifest"]
StartMethod = Literal["auto", "fork", "spawn", "forkserver"]


class ParallelHookSpec:
    @pytest.hookspec(firstresult=True)
    def pytest_parallel_max_workers(self) -> int | None:
        """Return the maximum worker count allowed for this test environment."""

    @pytest.hookspec
    def pytest_parallel_pre_spawn(self, config: pytest.Config, num_workers: int) -> None:
        """Run once after collection and before worker processes are spawned."""

    @pytest.hookspec
    def pytest_parallel_worker_env(self, env: dict[str, str], worker_id: int) -> None:
        """Mutate a worker subprocess environment."""

    @pytest.hookspec
    def pytest_parallel_file_groups(
        self, path: object, items: list[pytest.Item]
    ) -> list[str] | None:
        """Return additional affinity group names for one test file, or None."""

    @pytest.hookspec(firstresult=True)
    def pytest_parallel_file_weight(self, path: object, items: list[pytest.Item]) -> float | None:
        """Return the estimated relative cost of one test file, or None for its test count."""

    @pytest.hookspec
    def pytest_parallel_shard_worker(self, shard: object, num_workers: int) -> int | None:
        """Return a worker index pinning this shard, or None for automatic balancing."""


def pytest_addhooks(pluginmanager: pytest.PytestPluginManager) -> None:
    pluginmanager.add_hookspecs(ParallelHookSpec)


@pytest.hookimpl(trylast=True)
def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line("markers", "enable_network: allow network access during this test")
    config.addinivalue_line(
        "markers",
        "parallel_group(name, ...): assign related tests and their files to the same parallel worker",
    )
    if _json_plan_requested(config):
        _terminal_reporter_to_stderr(config)


def _json_plan_requested(config: pytest.Config) -> bool:
    value = config.getoption("parallel_plan", default=None)
    if value is None:
        return False
    return str(value).strip().lower() == "json"


def _terminal_reporter_to_stderr(config: pytest.Config) -> None:
    reporter = config.pluginmanager.get_plugin("terminalreporter")
    if reporter is None:
        return
    from _pytest.config import create_terminal_writer

    reporter._tw = create_terminal_writer(config, sys.stderr)


@pytest.hookimpl(hookwrapper=True, trylast=True)
def pytest_sessionfinish(session: pytest.Session, exitstatus: int) -> Generator[None]:
    yield
    from .coordinator import PLAN_PRINTED

    if not session.config.stash.get(PLAN_PRINTED, False) or session.testsfailed:
        return
    if exitstatus == pytest.ExitCode.NO_TESTS_COLLECTED:
        session.exitstatus = pytest.ExitCode.OK


def pytest_addoption(parser: pytest.Parser) -> None:
    group = parser.getgroup("parallel", "static parallel test execution")
    group._addoption(
        "-j",
        "--jobs",
        default="auto",
        dest="parallel_jobs",
        help="Run tests across N worker processes. Defaults to 'auto'.",
    )
    group._addoption(
        "--serial",
        action="store_true",
        default=False,
        dest="parallel_serial",
        help="Disable pytest-parallel and use pytest's standard serial runner.",
    )
    group._addoption(
        "--ramp",
        default=None,
        dest="parallel_ramp",
        help="Stagger worker first-test execution over DURATION (e.g. 5, 5s, 1m, 0.5h).",
    )
    group._addoption(
        "--parallel-balance",
        default="count",
        dest="parallel_balance",
        help="File sharding strategy: 'count' (default, LPT by estimated weight) or 'round-robin'.",
    )
    group._addoption(
        "--parallel-plan",
        default=None,
        nargs="?",
        const="text",
        dest="parallel_plan",
        help="Print the static sharding plan ('text' or 'json') and exit without running tests.",
    )
    group._addoption(
        "--parallel-start-method",
        default="auto",
        dest="parallel_start_method",
        help="Multiprocessing start method: 'auto' (default), 'fork', 'spawn', or 'forkserver'.",
    )
    group._addoption(
        "--parallel-network",
        default="loopback",
        dest="parallel_network",
        help="Worker network guard: 'loopback' (default) or 'inherit'.",
    )
    group._addoption(
        "--parallel-drain",
        default=None,
        dest="parallel_drain",
        help="Cooperative -x/--maxfail drain timeout. Defaults to 5 seconds.",
    )
    group._addoption(
        "--parallel-collection",
        default="nodeid",
        dest="parallel_collection",
        help="Worker collection: 'nodeid' (default) or 'manifest'.",
    )


@pytest.hookimpl(tryfirst=True)
def pytest_load_initial_conftests(
    early_config: pytest.Config, parser: pytest.Parser, args: list[str]
) -> None:
    _publish_process_identity(early_config)
    json_report_enabled = getattr(early_config.known_args_namespace, "json_report", False)
    if not json_report_enabled or find_spec("pytest_jsonreport") is None:
        return
    from .ext.json_report import JSONReportRouting

    early_config.pluginmanager.register(JSONReportRouting(), "pytest-parallel-json-report")


@pytest.hookimpl(tryfirst=True)
def pytest_runtestloop(session: pytest.Session) -> bool | None:
    plan_mode = _parse_plan(session.config.getoption("parallel_plan", default=None))
    if os.environ.get(_WORKER_MARKER_ENV):
        return None
    collection = _parse_collection(
        session.config.getoption("parallel_collection", default="nodeid")
    )
    if getattr(session.config.option, "setupplan", False):
        return None
    if session.config.getoption("parallel_serial", default=False):
        if plan_mode is not None:
            raise pytest.UsageError("--parallel-plan cannot be combined with --serial")
        return None

    requested = _parse_jobs(session.config.getoption("parallel_jobs", default="0"))
    ramp = _parse_ramp(session.config.getoption("parallel_ramp", default=None))
    drain = _parse_drain(session.config.getoption("parallel_drain", default=None))
    balance = _parse_balance(session.config.getoption("parallel_balance", default="count"))
    start_method = _parse_start_method(
        session.config.getoption("parallel_start_method", default="auto")
    )
    _parse_network(session.config.getoption("parallel_network", default="loopback"))

    if requested <= 0:
        if plan_mode is not None:
            raise pytest.UsageError(
                "--parallel-plan requires parallel execution (remove --serial / -j 0)"
            )
        return None

    numprocesses = getattr(session.config.option, "numprocesses", None)
    if numprocesses not in (None, 0, "0"):
        raise pytest.UsageError(
            "pytest-parallel and pytest-xdist (-n/--numprocesses) cannot distribute the same run; "
            "use one of them, or pass --serial to let xdist own distribution."
        )

    if getattr(session.config.option, "usepdb", False) or getattr(
        session.config.option, "trace", False
    ):
        raise pytest.UsageError(
            "pytest-parallel does not support interactive debugging (--pdb or --trace) in parallel workers; "
            "pass --serial to debug interactively."
        )

    if session.testsfailed and not getattr(
        session.config.option, "continue_on_collection_errors", False
    ):
        raise session.Interrupted(
            f"{session.testsfailed} error{'s' if session.testsfailed != 1 else ''} during collection"
        )

    if plan_mode is not None and getattr(session.config.option, "collectonly", False):
        raise pytest.UsageError("--parallel-plan cannot be combined with --collect-only")

    if getattr(session.config.option, "collectonly", False):
        return True

    if session.shouldfail:
        raise session.Failed(session.shouldfail)
    if session.shouldstop:
        raise session.Interrupted(session.shouldstop)

    from .coordinator import Coordinator

    coordinator = Coordinator(
        session.config,
        requested,
        ramp=ramp,
        balance=balance,
        start_method=start_method,
        drain=drain,
        collection=collection,
    )
    if plan_mode is not None:
        return coordinator.show_plan(session, plan_mode)
    return coordinator.run(session)


@pytest.hookimpl(hookwrapper=True, tryfirst=True)
def pytest_runtest_protocol(item: pytest.Item, nextitem: pytest.Item | None) -> Generator[None]:
    if item.get_closest_marker("enable_network") is not None:
        yield
        return
    if os.environ.get(_WORKER_MARKER_ENV) != "1":
        yield
        return
    if _parse_network(item.config.getoption("parallel_network", default="loopback")) == "inherit":
        yield
        return

    from .network import network_blocked

    with network_blocked():
        yield


def _parse_plan(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip().lower()
    if text in {"text", "human", ""}:
        return "text"
    if text == "json":
        return "json"
    raise pytest.UsageError(f"Invalid --parallel-plan value {value!r}; expected 'text' or 'json'.")


def _parse_jobs(value: object) -> int:
    if isinstance(value, bool):
        raise pytest.UsageError(f"Invalid --jobs value: {value!r}")
    if isinstance(value, int):
        if value < 0:
            raise pytest.UsageError(f"--jobs must be >= 0, got {value}")
        return value
    text = str(value).strip().lower()
    if text == "auto":
        return _auto_cpu_count()
    try:
        parsed = int(text)
    except ValueError as exc:
        raise pytest.UsageError(
            f"Invalid --jobs value {value!r}; expected 'auto' or a non-negative integer."
        ) from exc
    if parsed < 0:
        raise pytest.UsageError(f"--jobs must be >= 0, got {parsed}")
    return parsed


def _auto_cpu_count() -> int:
    process_count = getattr(os, "process_cpu_count", None)
    count = process_count() if callable(process_count) else None
    if count is None:
        count = os.cpu_count()
    return count if isinstance(count, int) and count > 0 else 1


def _parse_ramp(value: object) -> float:
    if value is None:
        return 0.0
    return _parse_duration(value, "--ramp")


def _parse_drain(value: object) -> float:
    if value is None:
        return _DEFAULT_DRAIN_SECONDS
    return _parse_duration(value, "--parallel-drain")


def _parse_duration(value: object, flag: str) -> float:
    if isinstance(value, bool):
        raise pytest.UsageError(f"Invalid {flag} value: {value!r}")
    if isinstance(value, int | float):
        seconds = float(value)
        if not math.isfinite(seconds) or seconds < 0.0:
            raise pytest.UsageError(f"{flag} must be a finite non-negative duration, got {value!r}")
        return seconds

    text = str(value).strip()
    if not text:
        raise pytest.UsageError(f"{flag} duration cannot be empty")
    match = _RAMP_PATTERN.match(text)
    if match is None:
        raise pytest.UsageError(
            f"Invalid {flag} value {value!r}; expected a non-negative number with optional s, m, or h suffix."
        )
    number_text, unit = match.groups()
    try:
        amount = float(number_text)
    except ValueError as exc:
        raise pytest.UsageError(f"Invalid {flag} value {value!r}") from exc
    if not math.isfinite(amount) or amount < 0.0:
        raise pytest.UsageError(f"{flag} must be a finite non-negative duration, got {value!r}")
    multipliers = {"": 1.0, "s": 1.0, "m": 60.0, "h": 3600.0}
    seconds = amount * multipliers[unit.lower()]
    if not math.isfinite(seconds):
        raise pytest.UsageError(f"{flag} duration overflow: {value!r}")
    return seconds


def _parse_collection(value: object) -> CollectionMode:
    text = str(value).strip().lower()
    if text == "nodeid":
        return "nodeid"
    if text == "manifest":
        return "manifest"
    raise pytest.UsageError(
        f"Invalid --parallel-collection value {value!r}; expected 'nodeid' or 'manifest'."
    )


def _parse_balance(value: object) -> BalanceStrategy:
    text = str(value).strip().lower()
    if text == "round-robin":
        return "round-robin"
    if text == "count":
        return "count"
    raise pytest.UsageError(
        f"Invalid --parallel-balance value {value!r}; expected 'round-robin' or 'count'."
    )


def _parse_network(value: object) -> Literal["loopback", "inherit"]:
    text = str(value).strip().lower()
    if text == "loopback":
        return "loopback"
    if text == "inherit":
        return "inherit"
    raise pytest.UsageError(
        f"Invalid --parallel-network value {value!r}; expected 'loopback' or 'inherit'."
    )


def _publish_process_identity(early_config: pytest.Config) -> None:
    from .api import RunInfo, _publish

    if os.environ.get(_WORKER_ENTRY_ENV) == "1":
        _parse_network(getattr(early_config.known_args_namespace, "parallel_network", "loopback"))
        _parse_drain(getattr(early_config.known_args_namespace, "parallel_drain", None))
        _publish(
            RunInfo(
                run_id=_run_id_from_env(required=True),
                role="worker",
                collection_seed=_collection_seed_from_env(),
            ),
            _worker_info_from_env(),
        )
        return
    if os.environ.get(_WORKER_MARKER_ENV):
        raise pytest.UsageError(
            "pytest-parallel worker marker is set without the worker entry sentinel; "
            "refusing to run tests in this process."
        )
    _parse_network(getattr(early_config.known_args_namespace, "parallel_network", "loopback"))
    _parse_drain(getattr(early_config.known_args_namespace, "parallel_drain", None))
    _publish(
        RunInfo(
            run_id=_run_id_from_env(required=False),
            role=_parent_role(early_config),
            collection_seed=_collection_seed_from_env(),
        ),
        None,
    )


def _parent_role(early_config: pytest.Config) -> Literal["controller", "serial"]:
    namespace = early_config.known_args_namespace
    if getattr(namespace, "parallel_serial", False):
        return "serial"
    requested = _parse_jobs(getattr(namespace, "parallel_jobs", "auto"))
    if requested <= 0:
        return "serial"
    return "controller"


def _run_id_from_env(*, required: bool) -> str:
    if _RUN_ID_ENV not in os.environ:
        if required:
            raise pytest.UsageError(f"{_RUN_ID_ENV} is required in a pytest-parallel worker")
        generated = uuid.uuid4().hex
        os.environ[_RUN_ID_ENV] = generated
        return generated
    raw = os.environ[_RUN_ID_ENV]
    if raw == "":
        raise pytest.UsageError(f"{_RUN_ID_ENV} must not be empty")
    return raw


def _collection_seed_from_env() -> int | None:
    if _COLLECTION_SEED_ENV not in os.environ:
        return None
    raw = os.environ[_COLLECTION_SEED_ENV]
    if _DECIMAL_PATTERN.fullmatch(raw) is None:
        raise pytest.UsageError(f"{_COLLECTION_SEED_ENV} must be a base-10 integer")
    return int(raw)


def _worker_info_from_env() -> WorkerInfo:
    index = _required_decimal(_WORKER_ID_ENV)
    count = _required_decimal(_WORKER_COUNT_ENV)
    if index < 0 or count < 1 or index >= count:
        raise pytest.UsageError("pytest-parallel worker index and count are invalid")
    return WorkerInfo(index=index, count=count)


def _required_decimal(name: str) -> int:
    raw = os.environ.get(name)
    if raw is None or _DECIMAL_PATTERN.fullmatch(raw) is None:
        raise pytest.UsageError(f"{name} must be a base-10 integer in a pytest-parallel worker")
    return int(raw)


def _parse_start_method(value: object) -> StartMethod:
    text = str(value).strip().lower()
    if text == "auto":
        return "auto"
    if text == "fork":
        return "fork"
    if text == "spawn":
        return "spawn"
    if text == "forkserver":
        return "forkserver"
    raise pytest.UsageError(
        f"Invalid --parallel-start-method value {value!r}; expected 'auto', 'fork', 'spawn', or 'forkserver'."
    )
