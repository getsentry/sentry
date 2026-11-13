import contextlib
import dataclasses
import re
import sys
import threading
from collections import Counter
from collections.abc import Generator, Iterator
from types import FrameType
from typing import Any, NamedTuple
from unittest import mock

import pytest
from django.db import connections, transaction
from django.db.backends.base.base import BaseDatabaseWrapper

SAVEPOINT_OVERFLOW = 64
SAVEPOINT_LOOP_REPEATS = 6
SAVEPOINT_LOOP_PROPERTY = "savepoint_loop"
SUMMARY_NODEIDS_PER_CALLER = 3

_SEP_LINE = "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"

SKIP_PATH_PARTS = (
    "/site-packages/django/",
    "/contextlib.py",
    "sentry/db/",
    "sentry/utils/db.py",
    "sentry/silo/base.py",
    "testutils/pytest/savepoints.py",
)
CALLER_SKIP_PATH_PARTS = SKIP_PATH_PARTS + (
    "sentry/utils/snowflake.py",
    "sentry/db/models/manager/base.py",
)
CALLER_SKIP_FUNCTIONS = (
    ("sentry/hybridcloud/models/outbox.py", "outbox_context"),
    ("sentry/db/models/", "save"),
    ("sentry/db/models/", "create"),
    ("sentry/db/models/", "get_or_create"),
    ("sentry/db/models/", "update_or_create"),
)
PATH_MARKERS = ("/src/", "/tests/", "/getsentry/", "/site-packages/")

SAVEPOINT_NAME_RE = re.compile(r"SAVEPOINT\s+\"?([\w$]+)\"?", re.IGNORECASE)
LOCKING_TAIL_RE = re.compile(r"\bFOR\s+(NO\s+KEY\s+UPDATE|UPDATE|KEY\s+SHARE|SHARE)\b", re.I)
WITH_WRITE_RE = re.compile(r"\b(INSERT\s+INTO|DELETE\s+FROM|UPDATE\s+\"?\w)", re.IGNORECASE)


@dataclasses.dataclass
class Savepoint:
    sid: str
    caller: str
    site: str
    has_xid: bool = False
    dead: bool = False


class TopCaller(NamedTuple):
    caller: str
    repeats: int
    site: str


@dataclasses.dataclass
class ApplicationTransaction:
    call_site: str
    counting_savepoints: int = 0
    live_counting: int = 0
    root_sid: str | None = None
    savepoints: list[Savepoint] = dataclasses.field(default_factory=list)
    open_stack: list[Savepoint] = dataclasses.field(default_factory=list)
    callers: Counter[str] = dataclasses.field(default_factory=Counter)
    sites_by_caller: dict[str, Counter[str]] = dataclasses.field(default_factory=dict)

    def record(self, savepoint: Savepoint) -> None:
        self.savepoints.append(savepoint)
        self.open_stack.append(savepoint)
        self.callers[savepoint.caller] += 1
        sites = self.sites_by_caller.get(savepoint.caller)
        if sites is None:
            sites = Counter()
            self.sites_by_caller[savepoint.caller] = sites
        sites[savepoint.site] += 1

    def top_caller(self) -> TopCaller:
        ranked = self.callers.most_common(1)
        if not ranked:
            return TopCaller("none", 0, "none")
        caller, repeats = ranked[0]
        top_sites = self.sites_by_caller[caller].most_common(1)
        site = top_sites[0][0]
        return TopCaller(caller, repeats, site)


@dataclasses.dataclass
class SavepointUsage:
    transactions: list[ApplicationTransaction] = dataclasses.field(default_factory=list)

    def clear(self) -> None:
        self.transactions.clear()


@dataclasses.dataclass
class Entry:
    atomic: Any
    harness: bool
    caller: str
    site: str
    txn: ApplicationTransaction | None = None
    root: bool = False


@dataclasses.dataclass
class ConnectionState:
    stack: list[Entry] = dataclasses.field(default_factory=list)
    entering: Entry | None = None

    def current_txn(self) -> ApplicationTransaction | None:
        if not self.stack:
            return None
        return self.stack[-1].txn


class LoopHit(NamedTuple):
    repeats: int
    nodeid: str
    site: str


class CallerSummary(NamedTuple):
    caller: str
    repeats: int
    site: str
    hits: list[LoopHit]


def short_path(path: str) -> str:
    cut = len(path)
    for marker in PATH_MARKERS:
        position = path.find(marker)
        if position != -1 and position < cut:
            cut = position
    if cut == len(path):
        return path
    return path[cut:].lstrip("/")


def contains_any(text: str, parts: tuple[str, ...]) -> bool:
    for part in parts:
        if part in text:
            return True
    return False


def first_app_site(start_depth: int) -> str:
    frame: FrameType | None = sys._getframe(start_depth)
    while frame is not None:
        filename = frame.f_code.co_filename
        if not contains_any(filename, SKIP_PATH_PARTS):
            return f"{short_path(filename)}:{frame.f_lineno}:{frame.f_code.co_name}"
        frame = frame.f_back
    return "unknown"


def is_caller_skipped(filename: str, function: str) -> bool:
    if contains_any(filename, CALLER_SKIP_PATH_PARTS):
        return True
    if function == "__enter__":
        return True
    for path_part, skipped_function in CALLER_SKIP_FUNCTIONS:
        if path_part in filename and function == skipped_function:
            return True
    return False


def caller_of_app_frame(start_depth: int) -> str:
    frame: FrameType | None = sys._getframe(start_depth)
    seen_app_frame = False
    while frame is not None:
        filename = frame.f_code.co_filename
        function = frame.f_code.co_name
        if not is_caller_skipped(filename, function):
            if seen_app_frame:
                return f"{short_path(filename)}:{frame.f_lineno}:{function}"
            seen_app_frame = True
        frame = frame.f_back
    return "unknown"


def is_harness(atomic: Any, caller_file: str, site: str) -> bool:
    if getattr(atomic, "_from_testcase", False):
        return True
    if caller_file.endswith("django/test/testcases.py"):
        return True
    return "pytest_django/" in site


def is_write_statement(sql: str, head: str) -> bool:
    if head.startswith(("INSERT", "UPDATE", "DELETE")):
        return True
    if head.startswith("WITH"):
        return WITH_WRITE_RE.search(sql) is not None
    if head.startswith("SELECT"):
        tail = sql[-120:]
        return LOCKING_TAIL_RE.search(tail) is not None
    return False


def mark_write(txn: ApplicationTransaction) -> None:
    for savepoint in txn.open_stack:
        if not savepoint.has_xid:
            savepoint.has_xid = True
            txn.live_counting += 1
    txn.counting_savepoints = max(txn.counting_savepoints, txn.live_counting)


def clear_xid(txn: ApplicationTransaction, savepoint: Savepoint) -> None:
    if savepoint.has_xid and not savepoint.dead:
        txn.live_counting -= 1
    savepoint.has_xid = False


def kill_all(txn: ApplicationTransaction) -> None:
    for savepoint in txn.savepoints:
        clear_xid(txn, savepoint)
        savepoint.dead = True
    txn.open_stack = []


def on_release(txn: ApplicationTransaction, sid: str) -> None:
    for index in range(len(txn.open_stack) - 1, -1, -1):
        if txn.open_stack[index].sid == sid:
            del txn.open_stack[index:]
            return


def on_rollback_to(txn: ApplicationTransaction, sid: str) -> None:
    if sid == txn.root_sid:
        kill_all(txn)
        return
    target_index = None
    for index in range(len(txn.savepoints) - 1, -1, -1):
        if txn.savepoints[index].sid == sid:
            target_index = index
            break
    if target_index is None:
        return
    target = txn.savepoints[target_index]
    for later in txn.savepoints[target_index + 1 :]:
        clear_xid(txn, later)
        later.dead = True
    clear_xid(txn, target)
    position = None
    for index, savepoint in enumerate(txn.open_stack):
        if savepoint is target:
            position = index
            break
    if position is not None:
        del txn.open_stack[position + 1 :]


class SavepointTracker:
    def __init__(self, usage: SavepointUsage) -> None:
        self.usage = usage
        self.active = True
        self.local = threading.local()
        self.attached: list[BaseDatabaseWrapper] = []

    def connection_state(self, alias: str) -> ConnectionState:
        states = getattr(self.local, "states", None)
        if states is None:
            states = {}
            self.local.states = states
        state = states.get(alias)
        if state is None:
            state = ConnectionState()
            states[alias] = state
        return state

    def attach(self, connection: BaseDatabaseWrapper) -> None:
        if self in connection.execute_wrappers:
            return
        connection.execute_wrappers.append(self)
        self.attached.append(connection)

    def detach_all(self) -> None:
        for connection in self.attached:
            if self in connection.execute_wrappers:
                connection.execute_wrappers.remove(self)
        self.attached.clear()

    def __call__(self, execute: Any, sql: Any, params: Any, many: Any, context: Any) -> Any:
        if not self.active:
            return execute(sql, params, many, context)
        state = self.connection_state(context["connection"].alias)
        text = str(sql)
        head = text[:24].lstrip().upper()
        if head.startswith("SAVEPOINT"):
            self.on_savepoint(state, text)
        txn = state.current_txn()
        if txn is not None:
            if head.startswith("RELEASE"):
                match = SAVEPOINT_NAME_RE.search(text)
                if match is not None:
                    on_release(txn, match.group(1))
            elif head.startswith("ROLLBACK TO"):
                match = SAVEPOINT_NAME_RE.search(text)
                if match is not None:
                    on_rollback_to(txn, match.group(1))
        result = execute(sql, params, many, context)
        if txn is not None and is_write_statement(text, head):
            rows_written = True
            cursor = context.get("cursor")
            rowcount = getattr(cursor, "rowcount", None)
            if rowcount is not None and rowcount >= 0:
                rows_written = rowcount > 0
            if rows_written:
                mark_write(txn)
        return result

    def on_savepoint(self, state: ConnectionState, sql: str) -> None:
        match = SAVEPOINT_NAME_RE.search(sql)
        if match is None:
            return
        sid = match.group(1)
        entering = state.entering
        if entering is not None and entering.harness:
            return
        txn = state.current_txn()
        if txn is None:
            return
        if entering is not None and entering.root:
            txn.root_sid = sid
            return
        if entering is not None:
            caller = entering.caller
            site = entering.site
        else:
            caller = caller_of_app_frame(1)
            site = first_app_site(1)
        savepoint = Savepoint(sid=sid, caller=caller, site=site)
        txn.record(savepoint)

    def enter(self, atomic: Any, original_enter: Any) -> Any:
        if not self.active:
            return original_enter(atomic)
        connection = transaction.get_connection(atomic.using)
        state = self.connection_state(connection.alias)
        caller_file = sys._getframe(2).f_code.co_filename
        site = first_app_site(2)
        harness = is_harness(atomic, caller_file, site)
        caller = caller_of_app_frame(2)
        entry = Entry(atomic=atomic, harness=harness, caller=caller, site=site)
        if not harness:
            parent_txn = state.current_txn()
            if parent_txn is not None:
                entry.txn = parent_txn
            else:
                entry.txn = ApplicationTransaction(call_site=site)
                entry.root = True
        state.stack.append(entry)
        state.entering = entry
        try:
            return original_enter(atomic)
        except BaseException:
            state.stack.remove(entry)
            raise
        finally:
            state.entering = None

    def exit(
        self, atomic: Any, exc_type: Any, exc_value: Any, traceback: Any, original_exit: Any
    ) -> Any:
        if not self.active:
            return original_exit(atomic, exc_type, exc_value, traceback)
        connection = transaction.get_connection(atomic.using)
        state = self.connection_state(connection.alias)
        try:
            return original_exit(atomic, exc_type, exc_value, traceback)
        finally:
            found = None
            for index in range(len(state.stack) - 1, -1, -1):
                if state.stack[index].atomic is atomic:
                    found = index
                    break
            if found is not None:
                entry = state.stack[found]
                del state.stack[found:]
                if entry.root and entry.txn is not None:
                    if exc_type is not None:
                        kill_all(entry.txn)
                    self.usage.transactions.append(entry.txn)

    @contextlib.contextmanager
    def installed(self) -> Iterator[None]:
        tracker = self
        original_enter = transaction.Atomic.__enter__
        original_exit = transaction.Atomic.__exit__
        original_init = BaseDatabaseWrapper.__init__

        def patched_enter(atomic: Any) -> Any:
            return tracker.enter(atomic, original_enter)

        def patched_exit(atomic: Any, exc_type: Any, exc_value: Any, traceback: Any) -> Any:
            return tracker.exit(atomic, exc_type, exc_value, traceback, original_exit)

        def patched_init(connection: BaseDatabaseWrapper, *args: Any, **kwargs: Any) -> None:
            original_init(connection, *args, **kwargs)
            tracker.attach(connection)

        for alias in connections:
            self.attach(connections[alias])
        try:
            with (
                mock.patch.object(transaction.Atomic, "__enter__", patched_enter),
                mock.patch.object(transaction.Atomic, "__exit__", patched_exit),
                mock.patch.object(BaseDatabaseWrapper, "__init__", patched_init),
            ):
                yield
        finally:
            self.active = False
            self.detach_all()


def format_overflow_message(txn: ApplicationTransaction) -> str:
    top = txn.top_caller()
    return f"""\
{_SEP_LINE}
A transaction in this test reached {txn.counting_savepoints} savepoints that each hold a
Postgres subtransaction id (the limit is {SAVEPOINT_OVERFLOW}).

  - Transaction opened at: {txn.call_site}
  - Savepoints holding an id: {txn.counting_savepoints}
  - Caller that opened the most savepoints: {top.caller} ({top.repeats})
  - Where that caller's savepoints were opened: {top.site}

Postgres caches up to {SAVEPOINT_OVERFLOW} subtransaction ids per transaction.
Past that the cache overflows, and every query on the database slows down for as
long as the transaction stays open.

This usually means a loop opens one savepoint per item inside a transaction.
Typically the fix is to move the transaction inside the loop, or to write the
rows in bulk.

If you think this doesn't apply to this test, use the
`savepoint_usage` fixture like so at the end of the test:

    class MyTestCase(TestCase):
        def test_very_special(self):
            self.savepoint_usage.clear()

Or like this in pytest-based tests:

    def test_very_special(savepoint_usage):
        # Do something odd with transactions here

        savepoint_usage.clear()
{_SEP_LINE}"""


def evaluate_usage(
    usage: SavepointUsage, nodeid: str, user_properties: list[tuple[str, Any]]
) -> None:
    for txn in usage.transactions:
        top = txn.top_caller()
        if txn.counting_savepoints >= SAVEPOINT_OVERFLOW:
            pytest.fail(format_overflow_message(txn))
        if top.repeats >= SAVEPOINT_LOOP_REPEATS:
            loop = {
                "nodeid": nodeid,
                "caller": top.caller,
                "repeats": top.repeats,
                "site": top.site,
                "counting_savepoints": txn.counting_savepoints,
                "call_site": txn.call_site,
            }
            user_properties.append((SAVEPOINT_LOOP_PROPERTY, loop))


@pytest.fixture(autouse=True)
def savepoint_usage(request: pytest.FixtureRequest) -> Generator[SavepointUsage]:
    usage = SavepointUsage()
    tracker = SavepointTracker(usage)
    with tracker.installed():
        yield usage
    evaluate_usage(usage, request.node.nodeid, request.node.user_properties)


def collect_loop_hits(stats: dict[str, list[Any]]) -> dict[str, list[LoopHit]]:
    hits_by_caller: dict[str, list[LoopHit]] = {}
    seen: set[tuple[str, str]] = set()
    for reports in stats.values():
        for report in reports:
            for name, loop in getattr(report, "user_properties", []):
                if name != SAVEPOINT_LOOP_PROPERTY:
                    continue
                key = (loop["nodeid"], loop["caller"])
                if key in seen:
                    continue
                seen.add(key)
                hit = LoopHit(repeats=loop["repeats"], nodeid=loop["nodeid"], site=loop["site"])
                hits = hits_by_caller.get(loop["caller"])
                if hits is None:
                    hits = []
                    hits_by_caller[loop["caller"]] = hits
                hits.append(hit)
    return hits_by_caller


def pytest_terminal_summary(terminalreporter: Any) -> None:
    hits_by_caller = collect_loop_hits(terminalreporter.stats)
    if not hits_by_caller:
        return
    summaries: list[CallerSummary] = []
    for caller, hits in hits_by_caller.items():
        ordered = sorted(hits, key=lambda hit: hit.repeats, reverse=True)
        worst = ordered[0]
        summary = CallerSummary(caller=caller, repeats=worst.repeats, site=worst.site, hits=ordered)
        summaries.append(summary)
    summaries.sort(key=lambda summary: summary.repeats, reverse=True)
    terminalreporter.section("savepoint loops")
    for summary in summaries:
        terminalreporter.write_line(
            f"{summary.caller}: up to {summary.repeats} savepoints in one transaction, "
            f"opened at {summary.site}"
        )
        for hit in summary.hits[:SUMMARY_NODEIDS_PER_CALLER]:
            terminalreporter.write_line(f"    {hit.nodeid} ({hit.repeats})")
