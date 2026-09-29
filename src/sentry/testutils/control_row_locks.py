import contextlib
import functools
import re
import sys
from collections.abc import Callable, Generator
from types import FrameType
from typing import Any

from django.apps import apps
from django.db import connections

from sentry.silo.base import SiloMode
from sentry.testutils.control_row_lock_allowlist import ALLOWED_CONTROL_ROW_LOCKS

_ROW_LOCK_RE = re.compile(r"\bFOR (?:NO KEY )?UPDATE\b")
_TABLE_RE = re.compile(r'\b(?:FROM|JOIN)\s+"(\w+)"')

# Frames in these modules are the machinery between a query and the code that
# asked for it, so the call site is the first frame outside them.
_PLUMBING_PREFIXES = (
    "django.",
    "sentry.db.",
    "sentry.silo.",
    "sentry.testutils.control_row_locks",
    "sentry.testutils.hybrid_cloud",
    "sentry_sdk.",
    "contextlib",
)

# Locks taken directly by test code (setup helpers and the like) never run in
# production, so only locks from Sentry's own code are checked.
_TEST_CODE_PREFIXES = ("tests.", "fixtures.")


class ControlRowLockError(AssertionError):
    pass


@functools.cache
def _control_tables() -> frozenset[str]:
    tables = set()
    for model in apps.get_models():
        silo_limit = getattr(model._meta, "silo_limit", None)
        if silo_limit is not None and silo_limit.modes == {SiloMode.CONTROL}:
            tables.add(model._meta.db_table)
    return frozenset(tables)


def _call_site() -> str:
    frame: FrameType | None = sys._getframe(1)
    while frame is not None:
        module = frame.f_globals.get("__name__", "")
        if not module.startswith(_PLUMBING_PREFIXES):
            return f"{module}.{frame.f_code.co_qualname}"
        frame = frame.f_back
    return "<unknown>"


class ControlRowLockWrapper:
    def __call__(
        self, execute: Callable[..., Any], sql: str, params: Any, many: bool, context: Any
    ) -> Any:
        if _ROW_LOCK_RE.search(sql):
            locked = set(_TABLE_RE.findall(sql)) & _control_tables()
            if locked:
                call_site = _call_site()
                if call_site.startswith(_TEST_CODE_PREFIXES):
                    return execute(sql, params, many, context)
                for table in sorted(locked):
                    if (table, call_site) not in ALLOWED_CONTROL_ROW_LOCKS:
                        raise ControlRowLockError(
                            f"{call_site} takes a row lock (SELECT ... FOR UPDATE) on the "
                            f"Control silo table {table}. A new lock like this on "
                            "sentry_organizationintegration stalled the Control database in "
                            "INC-2480. Prefer an atomic conditional UPDATE. If the lock is "
                            "needed, add it with a justification to "
                            "src/sentry/testutils/control_row_lock_allowlist.py."
                        )
        return execute(sql, params, many, context)


@contextlib.contextmanager
def enforce_control_row_lock_allowlist() -> Generator[None]:
    with contextlib.ExitStack() as stack:
        for conn in connections.all():
            stack.enter_context(conn.execute_wrapper(ControlRowLockWrapper()))
        yield
