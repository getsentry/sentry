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

# Postgres caches this many subtransaction ids per transaction; past it every query slows down.
SUBTRANSACTION_CACHE_SIZE = 64
# Report-only: one function opening this many savepoints in a transaction looks like a loop.
LOOP_REPORT_THRESHOLD = 6
SAVEPOINT_LOOP_PROPERTY = "savepoint_loop"
SAVEPOINT_BASELINE_PROPERTY = "savepoint_baseline_hit"
SAVEPOINT_BASELINE_INI = "savepoint_baseline"
SUMMARY_NODEIDS_PER_OPENER = 3
STATEMENT_HEAD_CHARS = 24
LOCKING_CLAUSE_TAIL_CHARS = 120

_SEP_LINE = "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"

CONTEXTLIB_PATH_PART = "/contextlib.py"
SKIPPED_PATH_PARTS = (
    CONTEXTLIB_PATH_PART,
    "/site-packages/django/",
    "sentry/db/",
    "sentry/utils/db.py",
    "sentry/silo/base.py",
    "sentry/utils/snowflake.py",
    "sentry/testutils/pytest/stale_database_reads.py",
)
SKIPPED_FUNCTIONS = (("sentry/hybridcloud/models/outbox.py", "outbox_context"),)
PATH_MARKERS = ("/src/", "/tests/", "/getsentry/", "/site-packages/")

SAVEPOINT_NAME_RE = re.compile(r"SAVEPOINT\s+\"?([\w$]+)\"?", re.IGNORECASE)
LOCKING_TAIL_RE = re.compile(r"\bFOR\s+(NO\s+KEY\s+UPDATE|UPDATE|KEY\s+SHARE|SHARE)\b", re.I)
WITH_WRITE_RE = re.compile(r"\b(INSERT\s+INTO|DELETE\s+FROM|UPDATE\s+\"?\w)", re.IGNORECASE)


class Opening(NamedTuple):
    opened_in: str
    line: int


class TopOpener(NamedTuple):
    opened_in: str
    line: int
    savepoints_opened: int


class LoopHit(NamedTuple):
    savepoints_opened: int
    nodeid: str
    line: int


class OpenerSummary(NamedTuple):
    opened_in: str
    line: int
    savepoints_opened: int
    hits: list[LoopHit]


@dataclasses.dataclass
class Savepoint:
    sid: str
    opened_in: str
    holds_id: bool = False


@dataclasses.dataclass
class ApplicationTransaction:
    call_site: Opening
    peak_held_ids: int = 0
    held_ids: int = 0
    root_sid: str | None = None
    savepoints: list[Savepoint] = dataclasses.field(default_factory=list)
    open_stack: list[Savepoint] = dataclasses.field(default_factory=list)
    savepoints_opened: Counter[str] = dataclasses.field(default_factory=Counter)
    first_lines: dict[str, int] = dataclasses.field(default_factory=dict)

    def record(self, savepoint: Savepoint, line: int) -> None:
        self.savepoints.append(savepoint)
        self.open_stack.append(savepoint)
        self.savepoints_opened[savepoint.opened_in] += 1
        if savepoint.opened_in not in self.first_lines:
            self.first_lines[savepoint.opened_in] = line

    def top_opener(self) -> TopOpener:
        ranked = self.savepoints_opened.most_common(1)
        if not ranked:
            return TopOpener("none", 0, 0)
        opened_in, savepoints_opened = ranked[0]
        return TopOpener(opened_in, self.first_lines[opened_in], savepoints_opened)


@dataclasses.dataclass
class SavepointUsage:
    transactions: list[ApplicationTransaction] = dataclasses.field(default_factory=list)

    def clear(self) -> None:
        self.transactions.clear()


@dataclasses.dataclass
class Entry:
    atomic: Any
    opening: Opening
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


def outward_frames() -> Iterator[FrameType]:
    frame: FrameType | None = sys._getframe()
    while frame is not None:
        if frame.f_code.co_filename != __file__:
            yield frame
        frame = frame.f_back


def short_path(path: str, root_prefix: str) -> str:
    if path.startswith(root_prefix):
        return path[len(root_prefix) :]
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


def format_opening(opened_in: str, line: int) -> str:
    return f"{opened_in} (line {line})"


def format_call_site(txn: ApplicationTransaction) -> str:
    return format_opening(txn.call_site.opened_in, txn.call_site.line)


def is_skipped(filename: str, function: str) -> bool:
    if contains_any(filename, SKIPPED_PATH_PARTS):
        return True
    if function == "__enter__":
        return True
    for path_part, skipped_function in SKIPPED_FUNCTIONS:
        if path_part in filename and function == skipped_function:
            return True
    return False


def find_opening(root_prefix: str) -> Opening:
    for frame in outward_frames():
        filename = frame.f_code.co_filename
        function = frame.f_code.co_name
        if is_skipped(filename, function):
            continue
        path = short_path(filename, root_prefix)
        return Opening(f"{path}:{function}", frame.f_lineno)
    return Opening("unknown", 0)


def entered_by_harness(atomic: Any) -> bool:
    if getattr(atomic, "_from_testcase", False):
        return True
    for frame in outward_frames():
        filename = frame.f_code.co_filename
        if CONTEXTLIB_PATH_PART in filename:
            continue
        if filename.endswith("django/test/testcases.py"):
            return True
        return "pytest_django/" in filename
    return False


def is_write_statement(sql: str, head: str) -> bool:
    if head.startswith(("INSERT", "UPDATE", "DELETE")):
        return True
    if head.startswith("WITH"):
        return WITH_WRITE_RE.search(sql) is not None
    if head.startswith("SELECT"):
        tail = sql[-LOCKING_CLAUSE_TAIL_CHARS:]
        return LOCKING_TAIL_RE.search(tail) is not None
    return False


def last_index_of(savepoints: list[Savepoint], sid: str) -> int | None:
    for index in range(len(savepoints) - 1, -1, -1):
        if savepoints[index].sid == sid:
            return index
    return None


def mark_write(txn: ApplicationTransaction) -> None:
    # A write gives every open savepoint an id; a released one keeps it until the transaction ends.
    for savepoint in reversed(txn.open_stack):
        if savepoint.holds_id:
            break
        savepoint.holds_id = True
        txn.held_ids += 1
    txn.peak_held_ids = max(txn.peak_held_ids, txn.held_ids)


def release_ids(txn: ApplicationTransaction, savepoints: list[Savepoint]) -> None:
    for savepoint in savepoints:
        if savepoint.holds_id:
            savepoint.holds_id = False
            txn.held_ids -= 1


def release_all(txn: ApplicationTransaction) -> None:
    release_ids(txn, txn.savepoints)
    txn.open_stack.clear()


def on_release(txn: ApplicationTransaction, sid: str) -> None:
    index = last_index_of(txn.open_stack, sid)
    if index is not None:
        del txn.open_stack[index:]


def on_rollback_to(txn: ApplicationTransaction, sid: str) -> None:
    if sid == txn.root_sid:
        release_all(txn)
        return
    target_index = last_index_of(txn.savepoints, sid)
    if target_index is None:
        return
    target = txn.savepoints[target_index]
    opened_after = txn.savepoints[target_index + 1 :]
    rolled_back = [target, *opened_after]
    release_ids(txn, rolled_back)
    stack_index = last_index_of(txn.open_stack, sid)
    if stack_index is not None:
        del txn.open_stack[stack_index + 1 :]


class SavepointTracker:
    def __init__(self, usage: SavepointUsage, root_prefix: str) -> None:
        self.usage = usage
        self.root_prefix = root_prefix
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
        head = text[:STATEMENT_HEAD_CHARS].lstrip().upper()
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
            # A statement that touched no rows takes no id; a locking read that matched does.
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
        txn = state.current_txn()
        if txn is None:
            return
        entering = state.entering
        if entering is not None and entering.root:
            # In tests the outermost savepoint stands in for the transaction; it is not counted.
            txn.root_sid = sid
            return
        if entering is not None:
            opening = entering.opening
        else:
            opening = find_opening(self.root_prefix)
        savepoint = Savepoint(sid=sid, opened_in=opening.opened_in)
        txn.record(savepoint, opening.line)

    def enter(self, atomic: Any, original_enter: Any) -> Any:
        if not self.active:
            return original_enter(atomic)
        connection = transaction.get_connection(atomic.using)
        state = self.connection_state(connection.alias)
        opening = find_opening(self.root_prefix)
        entry = Entry(atomic=atomic, opening=opening)
        if not entered_by_harness(atomic):
            parent_txn = state.current_txn()
            if parent_txn is not None:
                entry.txn = parent_txn
            else:
                entry.txn = ApplicationTransaction(call_site=opening)
                entry.root = True
        state.stack.append(entry)
        # Django issues SAVEPOINT inside Atomic.__enter__; this links the statement to its atomic.
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
                        release_all(entry.txn)
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
    top = txn.top_opener()
    opener = format_opening(top.opened_in, top.line)
    return f"""\
{_SEP_LINE}
A transaction in this test reached {txn.peak_held_ids} savepoints that each hold a
Postgres subtransaction id (the limit is {SUBTRANSACTION_CACHE_SIZE}).

  - Transaction opened at: {format_call_site(txn)}
  - Savepoints holding an id: {txn.peak_held_ids}
  - Opened the most savepoints: {opener} ({top.savepoints_opened})

Postgres caches up to {SUBTRANSACTION_CACHE_SIZE} subtransaction ids per transaction.
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


def matching_baseline_entry(
    txn: ApplicationTransaction, top: TopOpener, baseline: frozenset[str]
) -> str | None:
    if txn.call_site.opened_in in baseline:
        return txn.call_site.opened_in
    if top.opened_in in baseline:
        return top.opened_in
    return None


def evaluate_usage(
    usage: SavepointUsage,
    nodeid: str,
    user_properties: list[tuple[str, Any]],
    baseline: frozenset[str],
) -> None:
    for txn in usage.transactions:
        top = txn.top_opener()
        call_site = format_call_site(txn)
        if txn.peak_held_ids >= SUBTRANSACTION_CACHE_SIZE:
            entry = matching_baseline_entry(txn, top, baseline)
            if entry is None:
                pytest.fail(format_overflow_message(txn))
            known_overflow = {
                "nodeid": nodeid,
                "entry": entry,
                "peak_held_ids": txn.peak_held_ids,
                "call_site": call_site,
            }
            user_properties.append((SAVEPOINT_BASELINE_PROPERTY, known_overflow))
        if top.savepoints_opened >= LOOP_REPORT_THRESHOLD:
            loop = {
                "nodeid": nodeid,
                "opened_in": top.opened_in,
                "line": top.line,
                "savepoints_opened": top.savepoints_opened,
                "peak_held_ids": txn.peak_held_ids,
                "call_site": call_site,
            }
            user_properties.append((SAVEPOINT_LOOP_PROPERTY, loop))


def read_baseline(config: pytest.Config) -> frozenset[str]:
    entries = config.getini(SAVEPOINT_BASELINE_INI)
    return frozenset(entries)


def pytest_addoption(parser: pytest.Parser) -> None:
    parser.addini(
        SAVEPOINT_BASELINE_INI,
        type="linelist",
        default=[],
        help="Functions whose transactions overflow the subtransaction cache today; "
        "their overflows are reported instead of failing the test.",
    )


@pytest.fixture(autouse=True)
def savepoint_usage(request: pytest.FixtureRequest) -> Generator[SavepointUsage]:
    usage = SavepointUsage()
    root_prefix = f"{request.config.rootpath}/"
    tracker = SavepointTracker(usage, root_prefix)
    with tracker.installed():
        yield usage
    baseline = read_baseline(request.config)
    evaluate_usage(usage, request.node.nodeid, request.node.user_properties, baseline)


def reported_properties(stats: dict[str, list[Any]], name: str) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    for reports in stats.values():
        for report in reports:
            for property_name, value in getattr(report, "user_properties", []):
                if property_name == name and value not in found:
                    found.append(value)
    return found


def collect_loop_hits(stats: dict[str, list[Any]]) -> dict[str, list[LoopHit]]:
    hits_by_opener: dict[str, list[LoopHit]] = {}
    for loop in reported_properties(stats, SAVEPOINT_LOOP_PROPERTY):
        hit = LoopHit(
            savepoints_opened=loop["savepoints_opened"],
            nodeid=loop["nodeid"],
            line=loop["line"],
        )
        hits = hits_by_opener.get(loop["opened_in"])
        if hits is None:
            hits = []
            hits_by_opener[loop["opened_in"]] = hits
        hits.append(hit)
    return hits_by_opener


def write_baseline_summary(terminalreporter: Any, baseline: frozenset[str]) -> None:
    known_overflows = reported_properties(terminalreporter.stats, SAVEPOINT_BASELINE_PROPERTY)
    terminalreporter.section("savepoint baseline")
    for entry in sorted(baseline):
        entry_overflows = [overflow for overflow in known_overflows if overflow["entry"] == entry]
        if not entry_overflows:
            terminalreporter.write_line(
                f"{entry}: no overflow in this run; remove the entry once its code is fixed"
            )
            continue
        ordered = sorted(entry_overflows, key=lambda overflow: overflow["peak_held_ids"])
        ordered.reverse()
        worst = ordered[0]["peak_held_ids"]
        terminalreporter.write_line(
            f"{entry}: {len(ordered)} tests overflowed, up to {worst} savepoints holding an id"
        )
        for overflow in ordered:
            terminalreporter.write_line(f"    {overflow['nodeid']} ({overflow['peak_held_ids']})")


def write_loop_summary(terminalreporter: Any) -> None:
    hits_by_opener = collect_loop_hits(terminalreporter.stats)
    if not hits_by_opener:
        return
    summaries: list[OpenerSummary] = []
    for opened_in, hits in hits_by_opener.items():
        ordered = sorted(hits, key=lambda hit: hit.savepoints_opened, reverse=True)
        worst = ordered[0]
        summary = OpenerSummary(
            opened_in=opened_in,
            line=worst.line,
            savepoints_opened=worst.savepoints_opened,
            hits=ordered,
        )
        summaries.append(summary)
    summaries.sort(key=lambda summary: summary.savepoints_opened, reverse=True)
    terminalreporter.section("savepoint loops")
    for summary in summaries:
        opener = format_opening(summary.opened_in, summary.line)
        terminalreporter.write_line(
            f"{opener}: up to {summary.savepoints_opened} savepoints opened in one transaction"
        )
        shown_hits = summary.hits[:SUMMARY_NODEIDS_PER_OPENER]
        for hit in shown_hits:
            terminalreporter.write_line(f"    {hit.nodeid} ({hit.savepoints_opened})")


def pytest_terminal_summary(terminalreporter: Any) -> None:
    baseline = read_baseline(terminalreporter.config)
    if baseline:
        write_baseline_summary(terminalreporter, baseline)
    write_loop_summary(terminalreporter)
