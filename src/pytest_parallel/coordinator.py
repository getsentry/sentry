from __future__ import annotations

import builtins
import json
import math
import multiprocessing
import os
import platform
import shlex
import shutil
import signal
import sys
import tempfile
import threading
import time
import types
import warnings
from collections.abc import Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal, Protocol, cast

import pytest

from .manifest import MANIFEST_ENV, dump_manifest
from .plugin import (
    _DEFAULT_DRAIN_SECONDS,
    _DEFAULT_MAX_WORKERS,
    BalanceStrategy,
    CollectionMode,
    StartMethod,
)
from .scheduling import (
    FileUnit,
    Unit,
    assign_units,
    format_plan_text,
    merge_units,
    plan_dict,
)
from .scheduling import (
    validate_group_names as _validate_hook_groups,
)
from .scheduling import (
    validate_weight as _validate_hook_weight,
)

PLAN_PRINTED = pytest.StashKey[bool]()

ReportOutcome = Literal["passed", "failed", "rerun", "skipped"]
ReportPhase = Literal["setup", "call", "teardown"]

_VALID_OUTCOMES: frozenset[str] = frozenset({"passed", "failed", "rerun", "skipped"})
_VALID_PHASES: frozenset[str] = frozenset({"setup", "call", "teardown"})
_PHASE_ORDER: tuple[ReportPhase, ...] = ("setup", "call", "teardown")

_WORKER_EXECUTION_HOOKS: frozenset[str] = frozenset(
    {
        "pytest_collect_directory",
        "pytest_collect_file",
        "pytest_collection",
        "pytest_collection_modifyitems",
        "pytest_fixture_post_finalizer",
        "pytest_fixture_setup",
        "pytest_generate_tests",
        "pytest_ignore_collect",
        "pytest_itemcollected",
        "pytest_make_collect_report",
        "pytest_pycollect_makeitem",
        "pytest_pycollect_makemodule",
        "pytest_pyfunc_call",
        "pytest_runtest_call",
        "pytest_runtest_makereport",
        "pytest_runtest_protocol",
        "pytest_runtest_setup",
        "pytest_runtest_teardown",
    }
)

_STRIP_VALUE_OPTIONS: frozenset[str] = frozenset(
    {
        "-j",
        "--jobs",
        "--ramp",
        "--parallel-balance",
        "--parallel-plan",
        "--parallel-start-method",
        "--parallel-drain",
        "--parallel-collection",
        "--basetemp",
        "--log-file",
        "--rootdir",
        "--junitxml",
        "--junit-xml",
    }
)

_STRIP_PREFIX_OPTIONS: tuple[str, ...] = (
    "--jobs=",
    "--ramp=",
    "--parallel-balance=",
    "--parallel-plan=",
    "--parallel-start-method=",
    "--parallel-drain=",
    "--parallel-collection=",
    "--basetemp=",
    "--log-file=",
    "--rootdir=",
    "--junitxml=",
    "--junit-xml=",
)

_STRIP_FLAG_OPTIONS: frozenset[str] = frozenset(
    {"--lf", "--ff", "--nf", "--cache-clear", "--sw", "--stepwise"}
)

_CACHE_PROVIDER_PLUGINS: frozenset[str] = frozenset({"cacheprovider", "pytest_cacheprovider"})

_KEEP_VALUE_OPTIONS: frozenset[str] = frozenset(
    {
        "-c",
        "-k",
        "-m",
        "-o",
        "-p",
        "-r",
        "-W",
        "--capture",
        "--code-highlight",
        "--color",
        "--confcutdir",
        "--durations",
        "--durations-min",
        "--import-mode",
        "--log-cli-date-format",
        "--log-cli-format",
        "--log-cli-level",
        "--log-date-format",
        "--log-file-date-format",
        "--log-file-format",
        "--log-file-level",
        "--log-format",
        "--log-level",
        "--maxfail",
        "--override-ini",
        "--pythonwarnings",
        "--show-capture",
        "--tb",
    }
)


class ShardItem(Protocol):
    @property
    def nodeid(self) -> str: ...

    @property
    def location(self) -> tuple[str, int | None, str]: ...


@dataclass
class ActiveTestState:
    nodeid: str
    location: tuple[str, int | None, str]
    attempt: int
    reports: dict[str, pytest.TestReport] = field(default_factory=dict)


@dataclass
class WorkerState:
    worker_id: int
    process: Any
    result_path: Path
    output_path: Path
    assigned: list[str]
    assigned_set: set[str] = field(init=False)
    offset: int = 0
    started: list[str] = field(default_factory=list)
    started_set: set[str] = field(default_factory=set)
    completed: list[str] = field(default_factory=list)
    completed_set: set[str] = field(default_factory=set)
    failed_nodeids: list[str] = field(default_factory=list)
    current_test: ActiveTestState | None = None
    pending_retry: tuple[str, int] | None = None
    last_finished_attempt: tuple[str, int] | None = None
    last_nodeid: str | None = None
    collection_verified: bool = False
    collected_nodeids: list[str] | None = None
    collect_failed: bool = False
    session_finished: bool = False
    session_exitstatus: int | None = None
    session_shouldstop: str | None = None
    session_shouldfail: str | None = None
    protocol_errors: list[str] = field(default_factory=list)
    stopped_by_coordinator: bool = False

    def __post_init__(self) -> None:
        self.assigned_set = set(self.assigned)

    @property
    def unreported(self) -> list[str]:
        remaining = list(self.completed)
        missing: list[str] = []
        for nodeid in self.assigned:
            try:
                remaining.remove(nodeid)
            except ValueError:
                missing.append(nodeid)
        return missing


class Coordinator:
    def __init__(
        self,
        config: pytest.Config,
        requested_workers: int,
        *,
        ramp: float = 0.0,
        balance: BalanceStrategy = "count",
        start_method: StartMethod = "auto",
        drain: float = _DEFAULT_DRAIN_SECONDS,
        collection: CollectionMode = "nodeid",
    ) -> None:
        self.config = config
        self.requested_workers = requested_workers
        self.ramp = ramp
        self.balance: BalanceStrategy = balance
        self.start_method: StartMethod = start_method
        self.drain = drain
        self.collection: CollectionMode = collection
        self._num_workers: int | None = None
        self._work_dir: Path | None = None
        self._effective_max_workers: int | None = None
        self._completed = 0
        self._failed = 0
        self._failed_nodeids: list[str] = []
        self._total = 0

    def _ensure_work_dir(self) -> Path:
        if self._work_dir is None:
            explicit_basetemp = self._explicit_option("basetemp")
            if explicit_basetemp:
                base = Path(explicit_basetemp)
                if not base.is_absolute():
                    rootpath = (
                        self.config.rootpath
                        if isinstance(getattr(self.config, "rootpath", None), Path)
                        else Path.cwd()
                    )
                    base = rootpath / base
                base.mkdir(parents=True, exist_ok=True)
                self._work_dir = Path(tempfile.mkdtemp(prefix="pytest_parallel_", dir=base))
            else:
                self._work_dir = Path(tempfile.mkdtemp(prefix="pytest_parallel_"))
        return self._work_dir

    def show_plan(self, session: pytest.Session, mode: str) -> bool:
        rootpath = (
            self.config.rootpath
            if isinstance(getattr(self.config, "rootpath", None), Path)
            else Path.cwd()
        )
        if not session.items:
            plan = plan_dict([], [], balance=self.balance, pins={}, rootpath=rootpath)
        else:
            _, plan, _ = self._build_plan(session.items)
        if mode == "json":
            sys.stdout.write(json.dumps(plan, indent=2, sort_keys=True) + "\n")
            sys.stdout.flush()
        else:
            session.config.get_terminal_writer().line(format_plan_text(plan))
        self.config.stash[PLAN_PRINTED] = True
        return True

    def build_plan(self, items: Sequence[Any]) -> dict[str, Any]:
        _, plan, _ = self._build_plan(items)
        return plan

    def _build_plan(
        self, items: Sequence[Any]
    ) -> tuple[list[list[Any]], dict[str, Any], list[list[Unit]]]:
        session = getattr(items[0], "session", None) if items else None
        units = self._build_units(items, session)
        max_workers = self._resolve_max_workers()
        self._effective_max_workers = max_workers
        num_workers = max(1, min(self.requested_workers, len(units), max_workers))
        pins = self._resolve_pins(units, num_workers, session)
        buckets = assign_units(units, num_workers, balance=self.balance, pins=pins)
        rootpath = (
            self.config.rootpath
            if isinstance(getattr(self.config, "rootpath", None), Path)
            else Path.cwd()
        )
        plan = plan_dict(buckets, units, balance=self.balance, pins=pins, rootpath=rootpath)
        groups = [[item for unit in bucket for item in unit.items] for bucket in buckets]
        if self.collection == "manifest":
            positions_by_item: dict[int, list[int]] = {}
            for position, item in enumerate(items):
                positions_by_item.setdefault(id(item), []).append(position)
            for group in groups:
                occurrences_by_item: dict[int, int] = {}
                positioned: list[tuple[int, Any]] = []
                for item in group:
                    identity = id(item)
                    occurrence = occurrences_by_item.get(identity, 0)
                    positioned.append((positions_by_item[identity][occurrence], item))
                    occurrences_by_item[identity] = occurrence + 1
                group[:] = [item for _, item in sorted(positioned, key=lambda pair: pair[0])]
        return groups, plan, buckets

    def _build_units(self, items: Sequence[Any], session: Any | None = None) -> list[Unit]:
        rootpath = (
            self.config.rootpath
            if isinstance(getattr(self.config, "rootpath", None), Path)
            else Path.cwd()
        )
        files: list[FileUnit] = []
        by_key: dict[str, FileUnit] = {}
        for item in items:
            path, key = _item_file(item, rootpath)
            file_unit = by_key.get(key)
            if file_unit is None:
                file_unit = FileUnit(path=path, key=key, ordinal=len(files))
                by_key[key] = file_unit
                files.append(file_unit)
            file_unit.items.append(item)
            file_unit.groups.update(_extract_parallel_groups(item))
        for file_unit in files:
            hook = self._scoped_hook(session, self._absolute_file(file_unit))
            if hook is not None and hasattr(hook, "pytest_parallel_file_groups"):
                try:
                    results = hook.pytest_parallel_file_groups(
                        path=file_unit.path, items=list(file_unit.items)
                    )
                except AttributeError:
                    results = []
                if isinstance(results, list):
                    for result in results:
                        file_unit.groups.update(
                            _validate_hook_groups(
                                result, file_unit.path, "pytest_parallel_file_groups"
                            )
                        )
            weight: float = float(len(file_unit.items))
            if hook is not None and hasattr(hook, "pytest_parallel_file_weight"):
                try:
                    hook_weight = hook.pytest_parallel_file_weight(
                        path=file_unit.path, items=list(file_unit.items)
                    )
                except AttributeError:
                    hook_weight = None
                if hook_weight is not None:
                    weight = _validate_hook_weight(hook_weight, file_unit.path)
                    if not file_unit.items and weight != weight:
                        raise pytest.UsageError(
                            f"pytest_parallel_file_weight for {file_unit.path} is invalid"
                        )
            file_unit.weight = weight
        return merge_units(files)

    def _resolve_pins(
        self, units: Sequence[Unit], num_workers: int, session: Any | None = None
    ) -> dict[int, int]:
        hook = getattr(self.config, "hook", None)
        pins: dict[int, int] = {}
        caller = getattr(hook, "pytest_parallel_shard_worker", None) if hook is not None else None
        if caller is None:
            return pins
        for idx, unit in enumerate(units):
            shard = unit.shard()
            try:
                results = self._shard_worker_results(caller, session, unit, num_workers)
            except AttributeError:
                continue
            requested: set[int] = set()
            for result in results:
                if result is None:
                    continue
                if isinstance(result, bool) or not isinstance(result, int):
                    raise pytest.UsageError(
                        f"pytest_parallel_shard_worker for shard {list(shard.files)} must return an int worker index or None, got {result!r}"
                    )
                if result < 0 or result >= num_workers:
                    raise pytest.UsageError(
                        f"pytest_parallel_shard_worker for shard {list(shard.files)} returned worker {result}, outside [0, {num_workers})"
                    )
                requested.add(result)
            if len(requested) > 1:
                raise pytest.UsageError(
                    f"conflicting pytest_parallel_shard_worker pins for shard {list(shard.files)}: {sorted(requested)}"
                )
            if requested:
                pins[idx] = next(iter(requested))
        return pins

    def _scoped_hook(self, session: Any | None, path: Path) -> Any:
        if session is not None:
            get_proxy = getattr(session, "gethookproxy", None)
            if callable(get_proxy):
                return get_proxy(path)
        return getattr(self.config, "hook", None)

    def _absolute_file(self, file_unit: FileUnit) -> Path:
        key_path = Path(file_unit.key)
        if key_path.is_absolute():
            return key_path
        rootpath = (
            self.config.rootpath
            if isinstance(getattr(self.config, "rootpath", None), Path)
            else Path.cwd()
        )
        return rootpath / file_unit.path

    def _absolute_unit_path(self, path: Path) -> Path:
        if path.is_absolute():
            return path
        rootpath = (
            self.config.rootpath
            if isinstance(getattr(self.config, "rootpath", None), Path)
            else Path.cwd()
        )
        return rootpath / path

    def _shard_worker_results(
        self, caller: Any, session: Any | None, unit: Unit, num_workers: int
    ) -> list[Any]:
        shard = unit.shard()
        if (
            session is None
            or not hasattr(caller, "get_hookimpls")
            or not hasattr(session, "gethookproxy")
        ):
            return list(caller(shard=shard, num_workers=num_workers) or [])
        applicable: set[object] = set()
        for path in unit.files:
            proxy = session.gethookproxy(self._absolute_unit_path(path))
            proxy_caller = getattr(proxy, "pytest_parallel_shard_worker", None)
            if proxy_caller is None or not hasattr(proxy_caller, "get_hookimpls"):
                continue
            for impl in proxy_caller.get_hookimpls():
                applicable.add(impl.function)
        results: list[Any] = []
        seen: set[object] = set()
        for impl in caller.get_hookimpls():
            function = impl.function
            if function not in applicable or function in seen:
                continue
            if getattr(impl, "hookwrapper", False) or getattr(impl, "wrapper", False):
                continue
            seen.add(function)
            argnames = tuple(getattr(impl, "argnames", ()) or ())
            values = {"shard": shard, "num_workers": num_workers}
            kwargs = (
                values
                if not argnames
                else {name: value for name, value in values.items() if name in argnames}
            )
            results.append(function(**kwargs))
        return results

    def run(self, session: pytest.Session) -> bool:
        workers: list[tuple[int, Any, Path, Path]] = []
        self._ensure_work_dir()
        previous_sigterm: Any = None
        sigterm_installed = False
        try:
            if threading.current_thread() is threading.main_thread() and hasattr(signal, "SIGTERM"):
                try:
                    previous_sigterm = signal.signal(signal.SIGTERM, _sigterm_to_keyboard_interrupt)
                    sigterm_installed = True
                except (ValueError, OSError):
                    sigterm_installed = False
            if not session.items:
                return True

            self._validate_plugins()
            groups, plan, buckets = self._build_plan(session.items)
            num_workers = plan["num_workers"]
            if isinstance(num_workers, bool) or not isinstance(num_workers, int):
                raise RuntimeError(f"invalid worker pool size: {num_workers!r}")
            self._num_workers = num_workers
            self._total = len(session.items)
            if self.requested_workers > num_workers:
                limits: list[str] = []
                if plan["num_units"] <= num_workers:
                    limits.append(f"{plan['num_units']} scheduling units")
                if num_workers == self._effective_max_workers:
                    limits.append("max_workers limit")
                if limits:
                    session.config.get_terminal_writer().line(
                        f"pytest-parallel: requested {self.requested_workers} workers capped to {num_workers} "
                        f"({', '.join(limits)})"
                    )

            terminal = session.config.get_terminal_writer()
            terminal.sep("=", f"pytest-parallel: {num_workers} workers, {self._total} tests")
            for index, group in enumerate(groups):
                file_count = len({item.nodeid.partition("::")[0] for item in group})
                terminal.line(f"  worker {index}: {len(group)} tests ({file_count} files)")

            self.config.hook.pytest_parallel_pre_spawn(config=self.config, num_workers=num_workers)
            if session.shouldfail:
                raise session.Failed(session.shouldfail)
            if session.shouldstop:
                raise session.Interrupted(session.shouldstop)

            loads = [float(sum(unit.weight for unit in bucket)) for bucket in buckets]
            spawn_order = sorted(range(len(buckets)), key=lambda w: (-loads[w], w))
            rank = {worker_id: pos for pos, worker_id in enumerate(spawn_order)}
            active = [
                (index, [item.nodeid for item in group], rank[index])
                for index, group in enumerate(groups)
                if group
            ]
            active.sort(key=lambda entry: entry[2])
            _assert_safe_to_start_workers(self.start_method)
            workers = self._spawn(active)
            self._monitor(
                workers,
                {item.nodeid: item for item in session.items},
                session,
                assigned_by_worker={index: nodeids for index, nodeids, _ in active},
            )

            if session.shouldfail:
                raise session.Failed(session.shouldfail)
            if session.shouldstop:
                raise session.Interrupted(session.shouldstop)
            return True
        finally:
            self._terminate_live_workers(workers)
            if sigterm_installed:
                try:
                    signal.signal(signal.SIGTERM, previous_sigterm)
                except (ValueError, OSError):
                    pass
            if self._work_dir is not None:
                shutil.rmtree(self._work_dir, ignore_errors=True)

    def _resolve_max_workers(self) -> int:
        hook_value = self.config.hook.pytest_parallel_max_workers()
        if hook_value is None:
            return _DEFAULT_MAX_WORKERS
        if isinstance(hook_value, bool) or not isinstance(hook_value, int) or hook_value < 1:
            raise pytest.UsageError(
                f"pytest_parallel_max_workers must return a positive integer or None, got {hook_value!r}"
            )
        return hook_value

    def _validate_plugins(self) -> None:
        invocation_params = getattr(self.config, "invocation_params", None)
        plugins = getattr(invocation_params, "plugins", None)
        if not isinstance(plugins, Sequence) or isinstance(plugins, str | bytes):
            return
        for plugin in plugins:
            if isinstance(plugin, str | types.ModuleType):
                continue
            unsupported: list[str] = []
            for attr_name in dir(plugin):
                if attr_name in _WORKER_EXECUTION_HOOKS:
                    unsupported.append(attr_name)
                    continue
                try:
                    attr_val = getattr(plugin, attr_name)
                except Exception:
                    continue
                if hasattr(attr_val, "_pytestfixturefunction"):
                    unsupported.append(attr_name)
            if unsupported:
                hooks_desc = ", ".join(sorted(unsupported))
                raise pytest.UsageError(
                    f"In-memory plugin {plugin!r} implements worker execution or collection hooks "
                    f"({hooks_desc}) that cannot be forwarded to parallel worker processes. "
                    "Pass --serial or register the plugin by module name with -p."
                )

    def _explicit_option(self, name: str) -> str | None:
        option = getattr(self.config, "option", None)
        value = getattr(option, name, None) if option is not None else None
        if isinstance(value, Path):
            return str(value)
        if isinstance(value, str) and value:
            return value
        return None

    def _forwarded_args(
        self, worker_id: int | None = None, nodeids: Sequence[str] = ()
    ) -> list[str]:
        positionals, parser_value_options = self._parser_context()
        invocation = _sanitize_worker_args(
            self._invocation_args(),
            positionals=list(positionals),
            parser_value_options=parser_value_options,
        )
        plugins = self._forwarded_plugins()
        if worker_id is None:
            return [*invocation, *plugins]

        ini_addopts = _sanitize_worker_args(
            self._ini_addopts(),
            positionals=list(positionals),
            parser_value_options=parser_value_options,
        )
        env_addopts = _sanitize_worker_args(
            self._env_addopts(),
            positionals=list(positionals),
            parser_value_options=parser_value_options,
        )
        args = [*ini_addopts, *env_addopts, *invocation, *plugins, "--override-ini=addopts="]
        log_file = self._configured_log_file()
        if log_file:
            log_path = Path(log_file)
            per_worker = log_path.with_name(f"{log_path.stem}.worker-{worker_id}{log_path.suffix}")
            args.append(f"--log-file={per_worker}")
        else:
            args.append("--override-ini=log_file=")
        basetemp = self._worker_basetemp(worker_id)
        args.append(f"--basetemp={basetemp}")
        args.append(f"--override-ini=cache_dir={basetemp / 'pytest-cache'}")
        if self.collection == "manifest":
            args.extend(self._collection_arguments(nodeids))
        return args

    def _collection_arguments(self, nodeids: Sequence[str]) -> list[str]:
        known = getattr(self.config, "known_args_namespace", None)
        raw_positionals = getattr(known, "file_or_dir", []) or []
        rootpath = (
            self.config.rootpath
            if isinstance(getattr(self.config, "rootpath", None), Path)
            else Path.cwd()
        )
        assigned_files = {(rootpath / nodeid.partition("::")[0]).resolve() for nodeid in nodeids}
        arguments: list[str] = []
        for raw_path in raw_positionals:
            raw = str(raw_path)
            path = Path(raw.partition("::")[0])
            if not path.is_absolute():
                path = Path.cwd() / path
            if path.is_file():
                if path.resolve() in assigned_files:
                    arguments.append(str(path))
            else:
                arguments.append(raw)
        return arguments

    def _invocation_args(self) -> list[str]:
        invocation_params = getattr(self.config, "invocation_params", None)
        raw_args = getattr(invocation_params, "args", None)
        if not isinstance(raw_args, tuple | list):
            raw_args = sys.argv[1:]
        return [str(arg) for arg in raw_args]

    def _parser_context(self) -> tuple[list[str], set[str]]:
        known = getattr(self.config, "known_args_namespace", None)
        raw_positionals = getattr(known, "file_or_dir", []) or []
        positionals = [str(path) for path in raw_positionals]
        parser_value_options: set[str] = set()
        parser = getattr(self.config, "_parser", None)
        optparser = getattr(parser, "optparser", None)
        raw_actions = getattr(optparser, "_actions", [])
        if not isinstance(raw_actions, list | tuple):
            raw_actions = []
        for action in raw_actions:
            if getattr(action, "nargs", None) == 0:
                continue
            for opt in getattr(action, "option_strings", []) or []:
                parser_value_options.add(str(opt))
        return positionals, parser_value_options

    def _ini_addopts(self) -> list[str]:
        getini = getattr(self.config, "getini", None)
        if not callable(getini):
            return []
        try:
            value = getini("addopts")
        except (TypeError, ValueError, KeyError):
            return []
        if isinstance(value, str):
            return shlex.split(value)
        if isinstance(value, Sequence) and not isinstance(value, str | bytes):
            items: list[str] = []
            for item in value:
                if not isinstance(item, str):
                    return []
                items.append(item)
            return items
        return []

    @staticmethod
    def _env_addopts() -> list[str]:
        raw = os.environ.get("PYTEST_ADDOPTS", "")
        if not raw.strip():
            return []
        return shlex.split(raw)

    def _forwarded_plugins(self) -> list[str]:
        invocation_params = getattr(self.config, "invocation_params", None)
        plugins = getattr(invocation_params, "plugins", None)
        args: list[str] = []
        if not isinstance(plugins, Sequence) or isinstance(plugins, str | bytes):
            return args
        for plugin in plugins:
            name: str | None = None
            if isinstance(plugin, str):
                name = plugin
            elif isinstance(plugin, types.ModuleType):
                module_name = getattr(plugin, "__name__", None)
                name = module_name if isinstance(module_name, str) else None
            if name and name not in _CACHE_PROVIDER_PLUGINS:
                args.extend(["-p", name])
        return args

    def _configured_log_file(self) -> str | None:
        cli_log = self._explicit_option("log_file")
        if cli_log:
            return cli_log
        getini = getattr(self.config, "getini", None)
        if not callable(getini):
            return None
        try:
            value = getini("log_file")
        except (TypeError, ValueError, KeyError):
            return None
        if isinstance(value, Path):
            return str(value)
        if isinstance(value, str) and value:
            return value
        return None

    def _worker_basetemp(self, worker_id: int) -> Path:
        explicit_basetemp = self._explicit_option("basetemp")
        if explicit_basetemp:
            base = Path(explicit_basetemp)
            if not base.is_absolute():
                rootpath = (
                    self.config.rootpath
                    if isinstance(getattr(self.config, "rootpath", None), Path)
                    else Path.cwd()
                )
                base = rootpath / base
            return base / f"worker-{worker_id}"
        return self._ensure_work_dir() / "basetemp" / f"worker-{worker_id}"

    def _spawn(self, active: list[Any]) -> list[tuple[int, Any, Path, Path]]:
        from .worker import run_worker

        work_dir = self._ensure_work_dir()
        explicit_basetemp = self._explicit_option("basetemp")
        if explicit_basetemp:
            base = Path(explicit_basetemp)
            if not base.is_absolute():
                rootpath = (
                    self.config.rootpath
                    if isinstance(getattr(self.config, "rootpath", None), Path)
                    else Path.cwd()
                )
                base = rootpath / base
            base.mkdir(parents=True, exist_ok=True)
        else:
            (work_dir / "basetemp").mkdir(parents=True, exist_ok=True)
        context = cast(Any, _multiprocessing_context(self.start_method))
        workers: list[tuple[int, Any, Path, Path]] = []
        total_active = len(active)
        try:
            for pos, entry in enumerate(active):
                index, nodeids = entry[0], entry[1]
                ramp_rank = entry[2] if len(entry) > 2 else pos
                forwarded_args = self._forwarded_args(worker_id=index, nodeids=nodeids)
                result_path = work_dir / f"worker_{index}_results.jsonl"
                output_path = work_dir / f"worker_{index}_output.txt"
                result_path.touch()
                output_path.touch()
                env = os.environ.copy()
                env.pop("PYTEST_ADDOPTS", None)
                env.pop("_PYTEST_PARALLEL_WORKER_ENTRY", None)
                env.pop(MANIFEST_ENV, None)
                pool_size = self._num_workers
                if pool_size is None:
                    raise RuntimeError("worker pool size is unset")
                env["PYTEST_PARALLEL_WORKER_ID"] = str(index)
                env["PYTEST_PARALLEL_WORKER_COUNT"] = str(pool_size)
                env["_PYTEST_PARALLEL_WORKER"] = "1"
                if self.ramp > 0.0 and total_active > 1:
                    delay = self.ramp * ramp_rank / (total_active - 1)
                    env["_PYTEST_PARALLEL_RAMP_DELAY"] = f"{delay:.6f}"
                try:
                    term_size = shutil.get_terminal_size()
                    env.setdefault("COLUMNS", str(term_size.columns))
                    env.setdefault("LINES", str(term_size.lines))
                except Exception:
                    pass
                self.config.hook.pytest_parallel_worker_env(env=env, worker_id=index)
                env.pop(MANIFEST_ENV, None)
                if self.collection == "manifest":
                    manifest_path = work_dir / f"worker_{index}_manifest.json"
                    dump_manifest(manifest_path, nodeids)
                    env[MANIFEST_ENV] = str(manifest_path)

                process = context.Process(
                    target=run_worker,
                    args=(
                        env,
                        nodeids,
                        forwarded_args,
                        str(self.config.rootpath),
                        result_path,
                        output_path,
                    ),
                )
                process.start()
                workers.append((index, process, result_path, output_path))
        except BaseException:
            self._terminate_live_workers(workers)
            raise
        return workers

    def _monitor(
        self,
        workers: list[tuple[int, Any, Path, Path]],
        items_by_nodeid: dict[str, ShardItem],
        session: pytest.Session,
        *,
        assigned_by_worker: dict[int, list[str]] | None = None,
    ) -> None:
        terminal = session.config.get_terminal_writer()
        terminal_reporter = session.config.pluginmanager.get_plugin("terminalreporter")
        previous_showfspath = (
            getattr(terminal_reporter, "showfspath", None)
            if terminal_reporter is not None
            else None
        )
        if terminal_reporter is not None:
            terminal_reporter.showfspath = False

        work_dir = self._ensure_work_dir()
        stop_path = work_dir / "stop"

        worker_states: dict[int, WorkerState] = {}
        for index, process, result_path, output_path in workers:
            assigned = (
                list(assigned_by_worker[index])
                if assigned_by_worker is not None and index in assigned_by_worker
                else list(items_by_nodeid.keys())
            )
            worker_states[index] = WorkerState(
                worker_id=index,
                process=process,
                result_path=result_path,
                output_path=output_path,
                assigned=assigned,
            )

        try:
            alive = set(worker_states.keys())
            global_stop_requested = False
            drain_deadline: float | None = None

            while alive:
                for index in list(alive):
                    state = worker_states[index]
                    self._read_worker_events(state, items_by_nodeid, session, terminal, final=False)
                    if (session.shouldfail or session.shouldstop) and not global_stop_requested:
                        global_stop_requested = True
                        drain_deadline = time.monotonic() + self.drain
                        self._trigger_global_stop(stop_path, worker_states)
                    if not state.process.is_alive():
                        alive.discard(index)
                if alive:
                    if (
                        global_stop_requested
                        and drain_deadline is not None
                        and time.monotonic() >= drain_deadline
                    ):
                        self._terminate_live_workers(workers)
                        alive.clear()
                    else:
                        time.sleep(0.01)

            for state in worker_states.values():
                state.process.join(timeout=1.0)
                self._read_worker_events(state, items_by_nodeid, session, terminal, final=True)

            for state in worker_states.values():
                self._reconcile_worker(state, items_by_nodeid, session, terminal, terminal_reporter)
        except KeyboardInterrupt:
            self._trigger_global_stop(stop_path, worker_states)
            deadline = time.monotonic() + 1.0
            for state in worker_states.values():
                remaining = max(0.0, deadline - time.monotonic())
                try:
                    state.process.join(timeout=remaining)
                except Exception:
                    pass
            self._terminate_live_workers(workers)
            raise
        finally:
            if terminal_reporter is not None:
                if previous_showfspath is not None:
                    terminal_reporter.showfspath = previous_showfspath
                if session.config.pluginmanager.get_plugin("terminalreporter") is None:
                    session.config.pluginmanager.register(terminal_reporter, "terminalreporter")

    @staticmethod
    def _trigger_global_stop(stop_path: Path, worker_states: dict[int, WorkerState]) -> None:
        try:
            stop_path.touch()
        except OSError:
            pass
        for state in worker_states.values():
            if not state.session_finished:
                state.stopped_by_coordinator = True

    @staticmethod
    def _terminate_live_workers(workers: list[tuple[int, Any, Path, Path]]) -> None:
        for _, process, _, _ in workers:
            try:
                if process.is_alive():
                    process.terminate()
            except Exception:
                pass
        for _, process, _, _ in workers:
            try:
                if process.is_alive():
                    process.join(timeout=1.0)
                if process.is_alive() and hasattr(process, "kill"):
                    process.kill()
                    process.join(timeout=1.0)
                elif (
                    getattr(process, "pid", None) is not None
                    and getattr(process, "exitcode", None) is None
                ):
                    process.join(timeout=1.0)
            except Exception:
                pass

    def _read_worker_events(
        self,
        state: WorkerState,
        items_by_nodeid: dict[str, ShardItem],
        session: pytest.Session,
        terminal: Any,
        *,
        final: bool,
    ) -> None:
        if not state.result_path.exists():
            state.protocol_errors.append(f"worker {state.worker_id} result file is missing")
            return

        with state.result_path.open("rb") as result_file:
            result_file.seek(state.offset)
            chunk = result_file.read()

        if not chunk:
            return

        lines = chunk.splitlines(keepends=True)
        consumed_bytes = 0
        for raw_bytes in lines:
            if not raw_bytes.endswith(b"\n"):
                if final:
                    consumed_bytes += len(raw_bytes)
                    snippet = raw_bytes.decode("utf-8", errors="replace").strip()
                    state.protocol_errors.append(
                        f"truncated JSONL event at EOF from worker {state.worker_id}: {snippet[:120]!r}"
                    )
                break
            consumed_bytes += len(raw_bytes)
            line_text = raw_bytes.decode("utf-8", errors="replace").strip()
            if not line_text:
                state.protocol_errors.append(f"empty JSONL line from worker {state.worker_id}")
                continue
            try:
                parsed = json.loads(line_text)
            except json.JSONDecodeError as exc:
                state.protocol_errors.append(
                    f"malformed JSON event from worker {state.worker_id}: {exc.msg}"
                )
                continue
            if not isinstance(parsed, dict):
                state.protocol_errors.append(
                    f"non-object JSON event from worker {state.worker_id}: {type(parsed).__name__}"
                )
                continue
            self._process_worker_event(state, parsed, items_by_nodeid, session, terminal)

        state.offset += consumed_bytes

    def _process_worker_event(
        self,
        state: WorkerState,
        event: dict[str, Any],
        items_by_nodeid: dict[str, ShardItem],
        session: pytest.Session,
        terminal: Any,
    ) -> None:
        version = event.get("version")
        if version != 1:
            state.protocol_errors.append(
                f"unsupported protocol version {version!r} from worker {state.worker_id}"
            )
            return

        if state.session_finished:
            state.protocol_errors.append(
                f"event {event.get('type')!r} received after session_finish on worker {state.worker_id}"
            )
            return

        event_type = event.get("type")
        if event_type in {"test_start", "report", "test_finish", "warning"}:
            attempt = event.get("attempt")
            if isinstance(attempt, bool) or not isinstance(attempt, int) or attempt < 1:
                state.protocol_errors.append(
                    f"invalid attempt {attempt!r} on {event_type!r} event from worker {state.worker_id}"
                )
                return
        if event_type == "collection":
            self._handle_collection_event(state, event)
        elif event_type == "collect_report":
            self._handle_collect_report_event(state, event, session)
        elif event_type == "test_start":
            self._handle_test_start_event(state, event, items_by_nodeid)
        elif event_type == "report":
            self._handle_report_event(state, event, items_by_nodeid)
        elif event_type == "test_finish":
            self._handle_test_finish_event(state, event, session, terminal)
        elif event_type == "warning":
            self._handle_warning_event(state, event, session)
        elif event_type == "internal_error":
            excrepr = str(event.get("excrepr", "worker internal error"))
            state.protocol_errors.append(f"worker {state.worker_id} internal error: {excrepr}")
        elif event_type == "session_finish":
            self._handle_session_finish_event(state, event)
        else:
            state.protocol_errors.append(
                f"unknown event type {event_type!r} from worker {state.worker_id}"
            )

    def _handle_collection_event(self, state: WorkerState, event: dict[str, Any]) -> None:
        if state.collected_nodeids is not None:
            state.protocol_errors.append(
                f"duplicate collection event from worker {state.worker_id}"
            )
            return
        nodeids = event.get("nodeids")
        if not isinstance(nodeids, list) or not all(isinstance(x, str) for x in nodeids):
            state.protocol_errors.append(
                f"invalid collection nodeids from worker {state.worker_id}"
            )
            return
        collected = [str(x) for x in nodeids]
        state.collected_nodeids = collected
        if collected != state.assigned:
            collected_set = set(collected)
            missing = [n for n in state.assigned if n not in collected_set]
            extra = [n for n in collected if n not in state.assigned_set]
            details: list[str] = []
            if missing:
                details.append(f"missing={missing}")
            if extra:
                details.append(f"extra={extra}")
            if not details:
                details.append(f"reordered: expected {state.assigned}, got {collected}")
            state.protocol_errors.append(
                f"worker {state.worker_id} collection mismatch ({', '.join(details)})"
            )
            return
        state.collection_verified = True

    def _handle_collect_report_event(
        self,
        state: WorkerState,
        event: dict[str, Any],
        session: pytest.Session,
    ) -> None:
        report_data = event.get("report")
        if not isinstance(report_data, dict):
            state.protocol_errors.append(
                f"invalid collect_report payload from worker {state.worker_id}"
            )
            return
        collect_report = self._deserialize_collect_report(report_data)
        if collect_report is None:
            state.protocol_errors.append(
                f"failed to deserialize collect_report from worker {state.worker_id}"
            )
            return
        if collect_report.failed:
            state.collect_failed = True
        session.config.hook.pytest_collectreport(report=collect_report)

    def _handle_test_start_event(
        self,
        state: WorkerState,
        event: dict[str, Any],
        items_by_nodeid: dict[str, ShardItem],
    ) -> None:
        nodeid = event.get("nodeid")
        attempt = event.get("attempt")
        if not isinstance(nodeid, str) or not nodeid:
            state.protocol_errors.append(f"invalid test_start nodeid from worker {state.worker_id}")
            return
        if nodeid not in state.assigned_set:
            state.protocol_errors.append(
                f"unexpected test_start for unassigned test {nodeid!r} on worker {state.worker_id}"
            )
            return
        if state.current_test is not None:
            state.protocol_errors.append(
                f"test_start for {nodeid!r} while {state.current_test.nodeid!r} is still active on worker {state.worker_id}"
            )
            return
        pending_retry = state.pending_retry
        if pending_retry is not None:
            expected_nodeid, previous_attempt = pending_retry
            if nodeid != expected_nodeid or attempt != previous_attempt + 1:
                state.protocol_errors.append(
                    f"out-of-order retry start on worker {state.worker_id}: expected "
                    f"{expected_nodeid!r} attempt {previous_attempt + 1}, got {nodeid!r} attempt {attempt!r}"
                )
                return
            state.pending_retry = None
        else:
            expected_index = len(state.started)
            next_nodeid = (
                state.assigned[expected_index] if expected_index < len(state.assigned) else None
            )
            if next_nodeid != nodeid or attempt != 1:
                state.protocol_errors.append(
                    f"out-of-order test_start on worker {state.worker_id}: expected "
                    f"{next_nodeid!r} attempt 1, got {nodeid!r} attempt {attempt!r}"
                )
                return
            state.started.append(nodeid)
            state.started_set.add(nodeid)

        item = items_by_nodeid.get(nodeid)
        location = _parse_location(event.get("location"), item, nodeid)
        state.last_nodeid = nodeid
        state.current_test = ActiveTestState(
            nodeid=nodeid, location=location, attempt=cast(int, attempt)
        )

    def _handle_report_event(
        self,
        state: WorkerState,
        event: dict[str, Any],
        items_by_nodeid: dict[str, ShardItem],
    ) -> None:
        nodeid = event.get("nodeid")
        attempt = event.get("attempt")
        when = event.get("when")
        outcome = event.get("outcome")
        duration = event.get("duration")

        if not isinstance(nodeid, str) or not nodeid:
            state.protocol_errors.append(f"invalid report nodeid from worker {state.worker_id}")
            return
        if nodeid not in state.assigned_set:
            state.protocol_errors.append(
                f"unexpected report for unassigned test {nodeid!r} on worker {state.worker_id}"
            )
            return
        if not isinstance(when, str) or when not in _VALID_PHASES:
            state.protocol_errors.append(
                f"invalid report phase {when!r} for {nodeid!r} on worker {state.worker_id}"
            )
            return
        if not isinstance(outcome, str) or outcome not in _VALID_OUTCOMES:
            state.protocol_errors.append(
                f"invalid report outcome {outcome!r} for {nodeid!r} on worker {state.worker_id}"
            )
            return
        if (
            isinstance(duration, bool)
            or not isinstance(duration, int | float)
            or not math.isfinite(duration)
            or duration < 0.0
        ):
            state.protocol_errors.append(
                f"invalid report duration {duration!r} for {nodeid!r} on worker {state.worker_id}"
            )
            return

        if state.current_test is None or state.current_test.nodeid != nodeid:
            state.protocol_errors.append(
                f"report for {nodeid!r} ({when}) without matching active test on worker {state.worker_id}"
            )
            return

        active = state.current_test
        if attempt != active.attempt:
            state.protocol_errors.append(
                f"out-of-order attempt {attempt!r} report for {nodeid!r} on worker {state.worker_id}; "
                f"active attempt is {active.attempt}"
            )
            return
        if any(cast(str, report.outcome) == "rerun" for report in active.reports.values()):
            state.protocol_errors.append(
                f"report after rerun outcome for {nodeid!r} attempt {active.attempt} on worker {state.worker_id}"
            )
            return
        if when in active.reports:
            state.protocol_errors.append(
                f"duplicate {when!r} report for {nodeid!r} on worker {state.worker_id}"
            )
            return
        if when == "setup" and active.reports:
            state.protocol_errors.append(
                f"out-of-order setup report for {nodeid!r} on worker {state.worker_id}"
            )
            return
        if when == "call":
            setup_rep = active.reports.get("setup")
            if setup_rep is None or "teardown" in active.reports or not setup_rep.passed:
                state.protocol_errors.append(
                    f"invalid call phase transition for {nodeid!r} on worker {state.worker_id}"
                )
                return
        if when == "teardown" and "setup" not in active.reports:
            state.protocol_errors.append(
                f"teardown report before setup for {nodeid!r} on worker {state.worker_id}"
            )
            return

        item = items_by_nodeid.get(nodeid)
        report = self._deserialize_test_report(event, item, active.location)
        if report is None:
            state.protocol_errors.append(
                f"invalid serialized TestReport for {nodeid!r} ({when}) on worker {state.worker_id}"
            )
            return

        state.last_nodeid = nodeid
        active.reports[when] = report
        if report.failed and not hasattr(report, "wasxfail") and nodeid not in state.failed_nodeids:
            state.failed_nodeids.append(nodeid)
            self._failed += 1
            self._failed_nodeids.append(nodeid)

    def _handle_test_finish_event(
        self,
        state: WorkerState,
        event: dict[str, Any],
        session: pytest.Session,
        terminal: Any,
    ) -> None:
        nodeid = event.get("nodeid")
        attempt = event.get("attempt")
        final = event.get("final")
        if not isinstance(nodeid, str) or not nodeid:
            state.protocol_errors.append(
                f"invalid test_finish nodeid from worker {state.worker_id}"
            )
            return
        if state.current_test is None or state.current_test.nodeid != nodeid:
            state.protocol_errors.append(
                f"test_finish for {nodeid!r} without matching active test on worker {state.worker_id}"
            )
            return
        if state.completed.count(nodeid) >= state.assigned.count(nodeid):
            state.protocol_errors.append(
                f"duplicate test_finish for {nodeid!r} on worker {state.worker_id}"
            )
            return

        active = state.current_test
        if attempt != active.attempt:
            state.protocol_errors.append(
                f"out-of-order attempt {attempt!r} finish for {nodeid!r} on worker {state.worker_id}; "
                f"active attempt is {active.attempt}"
            )
            return
        if not isinstance(final, bool):
            state.protocol_errors.append(
                f"invalid final flag {final!r} for {nodeid!r} attempt {active.attempt} on worker {state.worker_id}"
            )
            return
        rerun_reports = [
            report for report in active.reports.values() if cast(str, report.outcome) == "rerun"
        ]
        if final == bool(rerun_reports):
            state.protocol_errors.append(
                f"attempt completion disagrees with rerun reports for {nodeid!r} attempt {active.attempt} "
                f"on worker {state.worker_id}"
            )
            return
        if len(rerun_reports) > 1:
            state.protocol_errors.append(
                f"multiple rerun reports for {nodeid!r} attempt {active.attempt} on worker {state.worker_id}"
            )
            return
        setup_rep = active.reports.get("setup")
        teardown_rep = active.reports.get("teardown")
        if final and (setup_rep is None or teardown_rep is None):
            state.protocol_errors.append(
                f"incomplete phase reports for {nodeid!r} at test_finish on worker {state.worker_id}"
            )
            state.current_test = None
            return
        setuponly = bool(getattr(self.config.option, "setuponly", False))
        if (
            final
            and setup_rep is not None
            and setup_rep.passed
            and not setuponly
            and "call" not in active.reports
        ):
            state.protocol_errors.append(
                f"missing call report for passed setup on {nodeid!r} on worker {state.worker_id}"
            )
            state.current_test = None
            return

        state.current_test = None
        state.last_finished_attempt = (nodeid, active.attempt)
        if final:
            state.completed.append(nodeid)
            state.completed_set.add(nodeid)
        else:
            state.pending_retry = (nodeid, active.attempt)
        state.last_nodeid = nodeid
        if final:
            self._completed += 1

        session.config.hook.pytest_runtest_logstart(nodeid=active.nodeid, location=active.location)
        uncaptured_stdout = event.get("stdout")
        if isinstance(uncaptured_stdout, str) and uncaptured_stdout:
            terminal.write(uncaptured_stdout)
            terminal.flush()
        for phase in _PHASE_ORDER:
            phase_report = active.reports.get(phase)
            if phase_report is not None:
                session.config.hook.pytest_runtest_logreport(report=phase_report)
        session.config.hook.pytest_runtest_logfinish(nodeid=active.nodeid, location=active.location)

    def _handle_warning_event(
        self,
        state: WorkerState,
        event: dict[str, Any],
        session: pytest.Session,
    ) -> None:
        message_text = event.get("message")
        category_module = event.get("category_module")
        category_name = event.get("category_name")
        filename = event.get("filename")
        lineno = event.get("lineno")
        when = event.get("when", "runtest")
        nodeid = event.get("nodeid", "")
        raw_location = event.get("location")
        attempt = event.get("attempt")

        if when == "runtest":
            current = state.current_test
            active_attempt = (
                (current.nodeid, current.attempt)
                if current is not None and current.nodeid == nodeid
                else None
            )
            if active_attempt != (nodeid, attempt) and state.last_finished_attempt != (
                nodeid,
                attempt,
            ):
                state.protocol_errors.append(
                    f"warning for {nodeid!r} attempt {attempt!r} without a matching test attempt "
                    f"on worker {state.worker_id}"
                )
                return

        if (
            not isinstance(message_text, str)
            or not isinstance(category_module, str)
            or not isinstance(category_name, str)
            or not isinstance(filename, str)
            or isinstance(lineno, bool)
            or not isinstance(lineno, int)
            or not isinstance(when, str)
            or not isinstance(nodeid, str)
        ):
            state.protocol_errors.append(f"invalid warning event from worker {state.worker_id}")
            return

        category = _resolve_warning_category(category_module, category_name)
        try:
            message_obj: Warning = category(message_text)
        except Exception:
            category = UserWarning
            message_obj = UserWarning(message_text)
        warning_msg = warnings.WarningMessage(
            message=message_obj,
            category=category,
            filename=filename,
            lineno=lineno,
            line=event.get("line") if isinstance(event.get("line"), str) else None,
        )
        location: tuple[str, int, str] | None = None
        if isinstance(raw_location, list) and len(raw_location) == 3:
            location = (str(raw_location[0]), int(raw_location[1]), str(raw_location[2]))

        session.config.hook.pytest_warning_recorded.call_historic(
            kwargs={
                "warning_message": warning_msg,
                "when": when,
                "nodeid": nodeid,
                "location": location,
            }
        )

    def _handle_session_finish_event(self, state: WorkerState, event: dict[str, Any]) -> None:
        exitstatus = event.get("exitstatus")
        if isinstance(exitstatus, bool) or not isinstance(exitstatus, int):
            state.protocol_errors.append(
                f"invalid session_finish exitstatus {exitstatus!r} from worker {state.worker_id}"
            )
            return
        if state.current_test is not None:
            state.protocol_errors.append(
                f"session_finish while {state.current_test.nodeid!r} is still active on worker {state.worker_id}"
            )
            return
        state.session_finished = True
        state.session_exitstatus = exitstatus
        shouldstop = event.get("shouldstop")
        shouldfail = event.get("shouldfail")
        state.session_shouldstop = str(shouldstop) if shouldstop is not None else None
        state.session_shouldfail = str(shouldfail) if shouldfail is not None else None

    def _reconcile_worker(
        self,
        state: WorkerState,
        items_by_nodeid: dict[str, ShardItem],
        session: pytest.Session,
        terminal: Any,
        terminal_reporter: Any,
    ) -> None:
        exitcode = state.process.exitcode
        global_stopped = bool(
            state.stopped_by_coordinator or session.shouldfail or session.shouldstop
        )

        if global_stopped and not state.protocol_errors:
            return

        if state.collect_failed and not state.protocol_errors and state.current_test is None:
            return

        failure_reasons: list[str] = list(state.protocol_errors)
        exit_desc = _format_exit_status(exitcode)

        if state.current_test is not None:
            failure_reasons.append(
                f"worker {state.worker_id} terminated prematurely ({exit_desc}) during {state.current_test.nodeid}"
            )

        if state.session_shouldstop:
            failure_reasons.append(
                f"worker {state.worker_id} stopped early: {state.session_shouldstop}"
            )

        if not state.session_finished and state.current_test is None:
            failure_reasons.append(
                f"worker {state.worker_id} exited without completing session ({exit_desc})"
            )

        unreported = state.unreported
        if unreported:
            preview = ", ".join(unreported[:5])
            if len(unreported) > 5:
                preview += f", ... (+{len(unreported) - 5} more)"
            failure_reasons.append(
                f"worker {state.worker_id} left {len(unreported)} assigned test(s) unreported: {preview}"
            )

        expected_exit = 1 if state.failed_nodeids else 0
        if not failure_reasons and (
            exitcode != expected_exit or state.session_exitstatus != expected_exit
        ):
            failure_reasons.append(
                f"worker {state.worker_id} exit status mismatch: process={exit_desc}, "
                f"session={state.session_exitstatus}, expected={expected_exit}"
            )

        if not failure_reasons:
            return

        output_text = ""
        if state.output_path.exists():
            try:
                output_text = state.output_path.read_text(
                    encoding="utf-8", errors="replace"
                ).strip()
            except OSError:
                output_text = ""

        diag_lines = [
            f"worker {state.worker_id} failure ({exit_desc})",
            f"last known test: {state.last_nodeid or '<none>'}",
            *failure_reasons,
        ]
        if output_text:
            diag_lines.append("--- worker output ---")
            diag_lines.extend(output_text.splitlines())
        longrepr_text = "\n".join(diag_lines)

        if state.current_test is not None:
            active = state.current_test
            state.current_test = None
            session.config.hook.pytest_runtest_logstart(
                nodeid=active.nodeid, location=active.location
            )
            for phase in _PHASE_ORDER:
                if phase in active.reports:
                    session.config.hook.pytest_runtest_logreport(report=active.reports[phase])
            missing_phase: ReportPhase = (
                "setup"
                if "setup" not in active.reports
                else (
                    "call"
                    if "call" not in active.reports and active.reports["setup"].passed
                    else "teardown"
                )
            )
            crash_report = pytest.TestReport(
                nodeid=active.nodeid,
                location=active.location,
                keywords={},
                outcome="failed",
                longrepr=longrepr_text,
                when=missing_phase,
                duration=0.0,
            )
            session.config.hook.pytest_runtest_logreport(report=crash_report)
            session.config.hook.pytest_runtest_logfinish(
                nodeid=active.nodeid, location=active.location
            )
        else:
            target_nodeid = (
                unreported[0]
                if unreported
                else (state.last_nodeid or f"<worker_{state.worker_id}>")
            )
            target_item = items_by_nodeid.get(target_nodeid)
            target_location = (
                target_item.location
                if target_item is not None
                else (target_nodeid.partition("::")[0], None, target_nodeid)
            )
            crash_report = pytest.TestReport(
                nodeid=target_nodeid,
                location=target_location,
                keywords={},
                outcome="failed",
                longrepr=longrepr_text,
                when="setup",
                duration=0.0,
            )
            session.config.hook.pytest_runtest_logstart(
                nodeid=target_nodeid, location=target_location
            )
            session.config.hook.pytest_runtest_logreport(report=crash_report)
            session.config.hook.pytest_runtest_logfinish(
                nodeid=target_nodeid, location=target_location
            )

        if state.last_nodeid and state.last_nodeid not in self._failed_nodeids:
            self._failed_nodeids.append(state.last_nodeid)
        self._failed += 1
        if session.testsfailed == 0:
            session.testsfailed += 1

        if terminal_reporter is not None and hasattr(terminal_reporter, "ensure_newline"):
            terminal_reporter.ensure_newline()
        else:
            terminal.line("")
        terminal.sep("-", f"worker {state.worker_id} failed ({exit_desc})")
        for line in diag_lines:
            terminal.line(line)

    def _deserialize_test_report(
        self,
        event: dict[str, Any],
        item: ShardItem | None,
        fallback_location: tuple[str, int | None, str],
    ) -> pytest.TestReport | None:
        nodeid = str(event["nodeid"])
        when = cast(ReportPhase, str(event["when"]))
        outcome = cast(ReportOutcome, str(event["outcome"]))
        duration = float(event["duration"])

        raw_report = event.get("report")
        if isinstance(raw_report, dict):
            data = dict(raw_report)
            data.setdefault("$report_type", "TestReport")
            try:
                restored = self.config.hook.pytest_report_from_serializable(
                    config=self.config, data=dict(data)
                )
                if not isinstance(restored, pytest.TestReport):
                    restored = pytest.TestReport._from_json(dict(data))
            except Exception:
                return None
            _normalize_deserialized_report(restored)
            if restored.nodeid != nodeid or restored.when != when or restored.outcome != outcome:
                return None
            return restored

        location = item.location if item is not None else fallback_location
        report = pytest.TestReport(
            nodeid=nodeid,
            location=location,
            keywords={},
            outcome=cast(Any, outcome),
            longrepr=cast(Any, event.get("longrepr")),
            when=when,
            duration=duration,
        )
        wasxfail = event.get("wasxfail")
        if isinstance(wasxfail, str):
            report.wasxfail = wasxfail
        return report

    def _deserialize_collect_report(
        self, raw_report: dict[str, Any]
    ) -> pytest.CollectReport | None:
        data = dict(raw_report)
        data.setdefault("$report_type", "CollectReport")
        try:
            restored = self.config.hook.pytest_report_from_serializable(
                config=self.config, data=dict(data)
            )
            if not isinstance(restored, pytest.CollectReport):
                restored = pytest.CollectReport._from_json(dict(data))
        except Exception:
            return None
        _normalize_deserialized_report(restored)
        return restored


def _normalize_deserialized_report(report: Any) -> None:
    loc = getattr(report, "location", None)
    if isinstance(loc, list) and len(loc) == 3:
        report.location = (str(loc[0]), int(loc[1]) if loc[1] is not None else None, str(loc[2]))
    longrepr = getattr(report, "longrepr", None)
    if isinstance(longrepr, list) and len(longrepr) == 3:
        report.longrepr = (
            str(longrepr[0]),
            int(longrepr[1]) if longrepr[1] is not None else None,
            str(longrepr[2]),
        )
    sections = getattr(report, "sections", None)
    if isinstance(sections, list):
        report.sections = [
            (str(sec[0]), str(sec[1]))
            for sec in sections
            if isinstance(sec, list | tuple) and len(sec) == 2
        ]
    user_props = getattr(report, "user_properties", None)
    if isinstance(user_props, list):
        report.user_properties = [
            (str(prop[0]), prop[1])
            for prop in user_props
            if isinstance(prop, list | tuple) and len(prop) == 2
        ]


def _parse_location(
    raw_location: Any,
    item: ShardItem | None,
    nodeid: str,
) -> tuple[str, int | None, str]:
    if isinstance(raw_location, list | tuple) and len(raw_location) == 3:
        lineno = (
            int(raw_location[1])
            if isinstance(raw_location[1], int) and not isinstance(raw_location[1], bool)
            else None
        )
        return (str(raw_location[0]), lineno, str(raw_location[2]))
    if item is not None:
        return item.location
    return (nodeid.partition("::")[0], None, nodeid)


def _format_exit_status(exitcode: int | None) -> str:
    if exitcode is None:
        return "still running"
    if exitcode < 0:
        sig_num = -exitcode
        try:
            sig_name = signal.Signals(sig_num).name
            return f"killed by signal {sig_num} ({sig_name}), exit code {exitcode}"
        except ValueError:
            return f"killed by signal {sig_num}, exit code {exitcode}"
    return f"exit code {exitcode}"


def _resolve_warning_category(module_name: str, qualname: str) -> type[Warning]:
    if module_name == "builtins":
        candidate = getattr(builtins, qualname, None)
        if isinstance(candidate, type) and issubclass(candidate, Warning):
            return candidate
    mod = sys.modules.get(module_name)
    if mod is not None:
        obj: Any = mod
        for part in qualname.split("."):
            obj = getattr(obj, part, None)
        if isinstance(obj, type) and issubclass(obj, Warning):
            return obj
    short_name = qualname.rsplit(".", 1)[-1]
    return type(short_name, (Warning,), {"__module__": module_name, "__qualname__": qualname})


def _attached_plugin_name(arg: str) -> str | None:
    if not arg.startswith("-p") or arg.startswith("--") or arg in {"-p", "-p="}:
        return None
    name = arg[2:]
    if not name:
        return None
    return name


def _sanitize_worker_args(
    raw_args: Sequence[object],
    *,
    positionals: list[str],
    parser_value_options: set[str],
) -> list[str]:
    args: list[str] = []
    raw = [str(arg) for arg in raw_args]
    index = 0
    after_double_dash = False
    while index < len(raw):
        arg = raw[index]
        if after_double_dash:
            if arg in positionals:
                positionals.remove(arg)
            else:
                args.append(arg)
            index += 1
            continue
        if arg == "--":
            after_double_dash = True
            index += 1
            continue
        if arg in _STRIP_VALUE_OPTIONS:
            index += 2
            continue
        if arg == "--serial" or arg in _STRIP_FLAG_OPTIONS or arg.startswith(_STRIP_PREFIX_OPTIONS):
            index += 1
            continue
        if arg.startswith("-j") and arg != "-j":
            index += 1
            continue
        plugin_name = _attached_plugin_name(arg)
        if plugin_name is not None:
            if plugin_name not in _CACHE_PROVIDER_PLUGINS:
                args.append(arg)
            index += 1
            continue
        if arg == "-p":
            if index + 1 >= len(raw):
                args.append(arg)
                index += 1
                continue
            plugin = raw[index + 1]
            if plugin not in _CACHE_PROVIDER_PLUGINS:
                args.extend((arg, plugin))
            index += 2
            continue
        if arg in _KEEP_VALUE_OPTIONS or arg in parser_value_options:
            args.append(arg)
            if index + 1 < len(raw):
                args.append(raw[index + 1])
                index += 2
            else:
                index += 1
            continue
        if arg in positionals:
            positionals.remove(arg)
            index += 1
            continue
        args.append(arg)
        index += 1
    return args


def _extract_parallel_groups(item: ShardItem) -> list[str]:
    iter_markers = getattr(item, "iter_markers", None)
    if not callable(iter_markers):
        return []
    try:
        markers = list(iter_markers("parallel_group"))
    except TypeError:
        return []

    groups: list[str] = []
    for mark in markers:
        kwargs = getattr(mark, "kwargs", {}) or {}
        args = getattr(mark, "args", ()) or ()
        unknown_kwargs = set(kwargs.keys()) - {"name"}
        if unknown_kwargs:
            unknown_str = ", ".join(sorted(unknown_kwargs))
            raise pytest.UsageError(
                f"parallel_group marker received unexpected keyword argument(s): {unknown_str}"
            )
        raw_names = list(args)
        if "name" in kwargs:
            raw_names.append(kwargs["name"])
        if not raw_names:
            raise pytest.UsageError(
                "parallel_group marker requires at least one non-empty group name"
            )
        for raw_name in raw_names:
            if not isinstance(raw_name, str) or not raw_name.strip():
                raise pytest.UsageError(
                    f"parallel_group marker requires non-empty string group names, got {raw_name!r}"
                )
            groups.append(raw_name.strip())
    return groups


def _sigterm_to_keyboard_interrupt(signum: int, frame: Any) -> None:
    raise KeyboardInterrupt


def _item_file(item: Any, rootpath: Path) -> tuple[Path, str]:
    raw_path = getattr(item, "path", None)
    if isinstance(raw_path, Path):
        try:
            display = raw_path.relative_to(rootpath)
        except Exception:
            display = raw_path
        return display, str(raw_path)
    file_name = str(getattr(item, "nodeid", "")).partition("::")[0]
    return Path(file_name), file_name


def _resolve_start_method_name(start_method: StartMethod | None = None) -> str:
    if start_method is None or start_method == "auto":
        system = platform.system()
        if system == "Darwin":
            return "spawn"
        if system == "Linux":
            return "forkserver"
        return "spawn"
    if start_method not in {"fork", "spawn", "forkserver"}:
        raise pytest.UsageError(
            f"Invalid --parallel-start-method {start_method!r}; expected 'auto', 'fork', 'spawn', or 'forkserver'."
        )
    return start_method


def _multiprocessing_context(
    start_method: StartMethod | None = None,
) -> multiprocessing.context.BaseContext:
    method_name = _resolve_start_method_name(start_method)
    try:
        return multiprocessing.get_context(method_name)
    except ValueError as exc:
        raise pytest.UsageError(
            f"Multiprocessing start method {method_name!r} is not supported on platform {sys.platform!r}."
        ) from exc


def _assert_safe_to_start_workers(start_method: StartMethod | None = None) -> None:
    method_name = _resolve_start_method_name(start_method)
    if method_name != "fork":
        return

    threads = _active_non_main_threads()
    if threads:
        names = ", ".join(thread.name for thread in threads)
        raise pytest.UsageError(
            "pytest-parallel cannot safely fork with active background threads. "
            f"Active threads: {names}. Stop these threads before pytest_runtestloop, use --serial, "
            "or pass --parallel-start-method=spawn."
        )


def _active_non_main_threads() -> list[threading.Thread]:
    main_thread = threading.main_thread()
    return [
        thread
        for thread in threading.enumerate()
        if thread is not main_thread and thread.is_alive()
    ]
