"""
Garbage collector tuning for process boot.

Booting Sentry imports thousands of modules and leaves several hundred thousand
long-lived objects behind. With CPython's default thresholds that triggers
several full collections during boot, and every later full collection walks
the whole boot heap again even though almost none of it can be freed.

`frozen_after_boot` pauses automatic collection while a boot step runs, then
collects once and moves every surviving object into the permanent generation
with `gc.freeze()`. Afterwards:

- full collections only walk objects created after boot, so they are much
  cheaper (they also run more often, because the unfrozen old generation is
  small);
- processes forked after the freeze (e.g. granian web workers under the
  "fork" start method) don't write GC bookkeeping into pages they share with
  their parent;
- interpreter shutdown doesn't walk the frozen heap, which makes exiting
  spawned children and CLI commands one to two seconds faster.

Trade-offs: cyclic garbage made of frozen objects is never reclaimed, frozen
objects in reference cycles are not finalized at interpreter exit, and
`gc.get_objects()` / `gc.get_referrers()` don't see frozen objects.

The collector is process-wide. While a boot step runs, children forked by
other threads inherit a disabled collector, so run boot steps on the thread
that forks. GC is re-enabled when a boot step ends, so `gc.disable()` called
during one (for example from sentry.conf.py) does not last; use
`gc.set_threshold(0)` or the kill switch instead.

Set `SENTRY_BOOT_GC_FREEZE=0` (or false/off/no) in the process environment to
turn all of this off, for example before debugging the heap. It is read when
each boot step starts, so it takes effect at the next process start, and
setting it from sentry.conf.py is too late for configure().

This module is imported before Django settings exist, so it may only import
the standard library at module level.
"""

from __future__ import annotations

import gc
import os
import time
from collections.abc import Generator
from contextlib import contextmanager

KILL_SWITCH_ENV_VAR = "SENTRY_BOOT_GC_FREEZE"
# The false spellings of sentry.utils.types.Bool. Unset or empty means enabled.
_DISABLED_VALUES = frozenset(("0", "false", "f", "no", "n", "off"))


def is_enabled() -> bool:
    return os.environ.get(KILL_SWITCH_ENV_VAR, "").strip().lower() not in _DISABLED_VALUES


@contextmanager
def frozen_after_boot(point: str) -> Generator[None]:
    """
    Pause automatic garbage collection while a boot step runs, then collect
    and freeze everything that survived it.

    Does nothing if the kill switch is set, or if GC is already disabled on
    entry: an enclosing `frozen_after_boot` (or whoever disabled GC) owns the
    collector and decides when to collect. If the boot step raises, GC is
    re-enabled and nothing is frozen.

    `point` names the boot step in metrics.
    """
    if not is_enabled() or not gc.isenabled():
        yield
        return

    gc.disable()
    try:
        yield
        start = time.monotonic()
        # Collect before freezing. Freezing alone would keep this boot's
        # garbage (failed connection attempts, their tracebacks and frames,
        # dead weak receivers) alive for the lifetime of the process.
        collected = gc.collect()
        gc.freeze()
        duration_ms = (time.monotonic() - start) * 1000
    finally:
        # Re-enable on every path, before this thread forks anything: children
        # inherit a disabled collector.
        gc.enable()

    _record(point, collected, duration_ms)


def _record(point: str, collected: int, duration_ms: float) -> None:
    # Imported here because sentry.utils.metrics needs Django settings at
    # import time, and this module is imported before they exist.
    from sentry.utils import metrics

    tags = {"point": point}
    # Emitted once per boot step: never sample these out.
    metrics.distribution(
        "runner.boot_gc.duration", duration_ms, tags=tags, unit="millisecond", sample_rate=1.0
    )
    metrics.distribution("runner.boot_gc.collected", collected, tags=tags, sample_rate=1.0)
