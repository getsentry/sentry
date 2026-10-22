"""
Garbage collector pause metrics.

Reports how often each generation is collected and how long the collecting
thread is paused, including the `__del__` and weakref callbacks that run
inside the collection:

- `python.gc.collections`: collections per generation (counter)
- `python.gc.pause_time`: milliseconds spent collecting per generation (counter)
- `python.gc.pause`: milliseconds per full (generation 2) collection
  (distribution, at most `MAX_SAMPLES` per flush)

All three are tagged with `generation` (0, 1 or 2) and `process`: `main` for a
process started directly, `child` for a multiprocessing or forked child. Web
workers started by granian, taskworker children and arroyo subprocesses are
all `child`.

install() runs at the end of initialize_app, so boot steps that run after it
are recorded like any other activity: the WSGI handler and warmup request in
web workers, and load_modules in taskworker children. Each process start
therefore adds about one or two full collections, a few hundred milliseconds
each with the boot heap. Read generation 2 frequency against worker and child
restarts.

Collections that start while automatic GC is disabled are not recorded. Only
code that manages the collector itself runs those, such as a boot step that
disables GC and collects once before freezing. Such a step adds nothing here
and has to report its own collection; add it back when comparing total GC
time with processes that don't run it.

A `gc.callbacks` entry runs inside the collector, on whichever thread
triggered the collection and possibly while that thread holds a lock, such as
a metrics client's buffer lock. Emitting from there can deadlock the process.
So the callback only does arithmetic on preallocated lists, and a daemon
thread emits the totals every `FLUSH_INTERVAL` seconds. Processes that end in
`os._exit`, such as granian workers and forked children, lose at most that
last interval.

Python signal handlers run at the next bytecode boundary on the main thread.
A signal that arrives during a collection is handled when this callback is
entered, before any of its code runs. If the handler raises there, CPython
reports the exception as unraisable and drops it. Handlers that only set
flags are unaffected, such as the shutdown handlers in granian, consumers and
the taskworker parent. Handlers that raise to abort work are affected:
taskworker processing deadlines (SIGALRM -> ProcessingDeadlineExceeded),
`sentry.taskworker.timeout.timeout_alarm`, and KeyboardInterrupt. Do not
enable this in taskworker processes.

This is off by default. Set `SENTRY_GC_METRICS=1` (or true/yes/on) in a
process's environment to turn it on. It is read when `initialize_app` runs.

`sentry.runner.initializer` imports this module before initialize_app has
applied the configuration, and importing `sentry.utils.metrics` builds the
metrics backend from settings. So only the standard library is imported at
module level.
"""

from __future__ import annotations

import atexit
import gc
import multiprocessing
import os
import threading
import time
from collections.abc import Callable

ENV_VAR = "SENTRY_GC_METRICS"
# The true spellings of sentry.utils.types.Bool.
_ENABLED_VALUES = frozenset(("1", "true", "t", "yes", "y", "on"))
_GENERATIONS = (0, 1, 2)
FLUSH_INTERVAL = 10.0
MAX_SAMPLES = 64
THREAD_NAME = "sentry-gc-metrics"


def is_enabled() -> bool:
    return os.environ.get(ENV_VAR, "").strip().lower() in _ENABLED_VALUES


class GCRecorder:
    """
    Accumulates collection counts and pause times. `callback` must not call
    into metrics, logging or the SDK, take a lock, raise or allocate tracked
    objects. Only one collection runs at a time, so each list has one writer.
    """

    __slots__ = ("_clock", "_start", "counts", "seconds", "samples")

    def __init__(self, clock: Callable[[], float] = time.perf_counter) -> None:
        self._clock = clock
        self._start = -1.0
        self.counts = [0, 0, 0]
        self.seconds = [0.0, 0.0, 0.0]
        self.samples: list[float] = []

    def callback(self, phase: str, info: dict[str, int]) -> None:
        if phase == "start":
            self._start = self._clock() if gc.isenabled() else -1.0
            return
        start = self._start
        # No paired start: skipped, or installed mid-collection.
        if start < 0:
            return
        self._start = -1.0
        elapsed = self._clock() - start
        generation = info.get("generation", -1)
        if generation not in _GENERATIONS:
            return
        self.counts[generation] += 1
        self.seconds[generation] += elapsed
        if generation == 2 and len(self.samples) < MAX_SAMPLES:
            self.samples.append(elapsed)


def _drain(samples: list[float]) -> list[float]:
    # A collection can append between these steps. Deleting only the first n
    # keeps that sample for the next drain.
    n = len(samples)
    batch = samples[:n]
    del samples[:n]
    return batch


def _millis(seconds: list[float]) -> list[int]:
    # Truncating the running total, not each delta, carries the fractions over.
    return [int(total * 1e3) for total in seconds]


class GCReporter:
    def __init__(self, recorder: GCRecorder, process: str) -> None:
        self.recorder = recorder
        self.process = process
        self.rebaseline()

    def rebaseline(self) -> None:
        self._counts = self.recorder.counts[:]
        self._millis = _millis(self.recorder.seconds)
        _drain(self.recorder.samples)

    def flush(self) -> None:
        # Importing this builds the backend from settings, which aren't fully
        # configured yet when this module is imported.
        from sentry.utils import metrics

        counts = self.recorder.counts[:]
        millis = _millis(self.recorder.seconds)
        samples = _drain(self.recorder.samples)
        # These are totals per flush interval, so they must never be sampled.
        for generation in _GENERATIONS:
            tags = {"generation": str(generation), "process": self.process}
            collections = counts[generation] - self._counts[generation]
            if collections:
                metrics.incr(
                    "python.gc.collections", amount=collections, tags=tags, sample_rate=1.0
                )
            pause_ms = millis[generation] - self._millis[generation]
            if pause_ms:
                metrics.incr(
                    "python.gc.pause_time",
                    amount=pause_ms,
                    tags=tags,
                    unit="millisecond",
                    sample_rate=1.0,
                )
        tags = {"generation": "2", "process": self.process}
        for elapsed in samples:
            metrics.distribution(
                "python.gc.pause", elapsed * 1000, tags=tags, unit="millisecond", sample_rate=1.0
            )
        self._counts, self._millis = counts, millis


_reporter: GCReporter | None = None
_lock = threading.Lock()
_stop = threading.Event()


def _flush() -> None:
    with _lock:
        if _reporter is not None:
            _reporter.flush()


def _run(stop: threading.Event) -> None:
    while not stop.wait(FLUSH_INTERVAL):
        _flush()


def _start_thread() -> None:
    threading.Thread(target=_run, args=(_stop,), name=THREAD_NAME, daemon=True).start()


# Holding the lock across fork means the child never inherits a metrics
# client lock taken by our thread mid-flush.
def _before_fork() -> None:
    _lock.acquire()


def _after_fork_in_parent() -> None:
    _lock.release()


def _after_fork_in_child() -> None:
    global _lock, _stop
    _lock = threading.Lock()
    _stop = threading.Event()
    if _reporter is not None:
        _reporter.process = "child"
        # The parent reports what it counted before the fork.
        _reporter.rebaseline()
    _start_thread()


def install() -> None:
    """
    Start recording GC pauses in this process if `SENTRY_GC_METRICS` is set.
    Forked children inherit the recorder and start their own thread; spawned
    children install it again when they configure Sentry.
    """
    global _reporter
    if _reporter is not None or not is_enabled():
        return
    recorder = GCRecorder()
    process = "main" if multiprocessing.parent_process() is None else "child"
    _reporter = GCReporter(recorder, process)
    gc.callbacks.append(recorder.callback)
    os.register_at_fork(
        before=_before_fork,
        after_in_parent=_after_fork_in_parent,
        after_in_child=_after_fork_in_child,
    )
    # Spawned children and CLI commands exit through sys.exit, so this
    # reports their last interval.
    atexit.register(_flush)
    _start_thread()
