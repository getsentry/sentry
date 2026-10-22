import atexit
import gc
import multiprocessing
import os
import threading
from collections.abc import Callable, Generator
from typing import Any, SupportsIndex
from unittest import mock

import pytest

from sentry.runner import gc_metrics
from sentry.runner.gc_metrics import MAX_SAMPLES, THREAD_NAME, GCRecorder, GCReporter

ENABLED = {gc_metrics.ENV_VAR: "1"}


def clock(*times: float) -> Callable[[], float]:
    return iter(times).__next__


def flusher_threads() -> list[threading.Thread]:
    return [thread for thread in threading.enumerate() if thread.name == THREAD_NAME]


def tags(generation: str) -> dict[str, str]:
    return {"generation": generation, "process": "main"}


@pytest.fixture
def gc_state() -> Generator[None]:
    callbacks = gc.callbacks[:]
    try:
        yield
    finally:
        gc.enable()
        gc.callbacks[:] = callbacks


@pytest.fixture
def module_state(gc_state: None) -> Generator[tuple[mock.MagicMock, mock.MagicMock]]:
    stop = threading.Event()
    with (
        mock.patch.object(gc_metrics, "_reporter", None),
        mock.patch.object(gc_metrics, "_lock", threading.Lock()),
        mock.patch.object(gc_metrics, "_stop", stop),
        mock.patch.object(os, "register_at_fork") as register_at_fork,
        mock.patch.object(atexit, "register") as atexit_register,
    ):
        try:
            yield register_at_fork, atexit_register
        finally:
            # _after_fork_in_child replaces the stop event.
            stop.set()
            gc_metrics._stop.set()
            for thread in flusher_threads():
                thread.join(timeout=5)
                assert not thread.is_alive()


@pytest.fixture
def emitted() -> Generator[tuple[mock.MagicMock, mock.MagicMock]]:
    with (
        mock.patch("sentry.utils.metrics.incr") as incr,
        mock.patch("sentry.utils.metrics.distribution") as distribution,
    ):
        yield incr, distribution


def install_without_thread() -> GCRecorder:
    with (
        mock.patch.dict(os.environ, ENABLED),
        mock.patch.object(gc_metrics, "_start_thread"),
    ):
        gc_metrics.install()
    assert gc_metrics._reporter is not None
    return gc_metrics._reporter.recorder


def test_records_full_collection() -> None:
    recorder = GCRecorder(clock=clock(1.0, 1.25))
    recorder.callback("start", {"generation": 2})
    recorder.callback("stop", {"generation": 2, "collected": 0, "uncollectable": 0})

    assert recorder.counts == [0, 0, 1]
    assert recorder.seconds == [0.0, 0.0, 0.25]
    assert recorder.samples == [0.25]


def test_young_collections_accumulate_without_samples() -> None:
    recorder = GCRecorder(clock=clock(1.0, 1.5, 2.0, 2.25, 3.0, 3.5))
    recorder.callback("start", {"generation": 0})
    recorder.callback("stop", {"generation": 0})
    recorder.callback("start", {"generation": 0})
    recorder.callback("stop", {"generation": 0})
    recorder.callback("start", {"generation": 1})
    recorder.callback("stop", {"generation": 1})

    assert recorder.counts == [2, 1, 0]
    assert recorder.seconds == [0.75, 0.5, 0.0]
    assert recorder.samples == []


def test_ignores_unpaired_stop() -> None:
    recorder = GCRecorder(clock=clock())
    recorder.callback("stop", {"generation": 2})

    assert recorder.counts == [0, 0, 0]
    assert recorder.samples == []


def test_skips_collections_while_gc_disabled(gc_state: None) -> None:
    recorder = GCRecorder()
    gc.callbacks.append(recorder.callback)
    gc.disable()
    gc.collect()

    assert recorder.counts == [0, 0, 0]
    assert recorder.samples == []


@pytest.mark.parametrize("info", [{"generation": 3}, {"generation": -1}, {}])
def test_ignores_unknown_generations(info: dict[str, int]) -> None:
    recorder = GCRecorder(clock=clock(1.0, 2.0))
    recorder.callback("start", info)
    recorder.callback("stop", info)

    assert recorder.counts == [0, 0, 0]
    assert recorder.seconds == [0.0, 0.0, 0.0]
    assert recorder.samples == []


def test_ignores_extra_info_keys() -> None:
    info: dict[str, Any] = {
        "generation": 2,
        "duration": 0.1,
        "candidates": 5,
        "collected": 0,
        "uncollectable": 0,
    }
    recorder = GCRecorder(clock=clock(1.0, 1.5))
    recorder.callback("start", info)
    recorder.callback("stop", info)

    assert recorder.counts == [0, 0, 1]
    assert recorder.samples == [0.5]


def test_caps_samples_but_not_totals() -> None:
    collections = MAX_SAMPLES + 10
    recorder = GCRecorder(clock=clock(*[0.0, 0.5] * collections))
    for _ in range(collections):
        recorder.callback("start", {"generation": 2})
        recorder.callback("stop", {"generation": 2})

    assert len(recorder.samples) == MAX_SAMPLES
    assert recorder.counts == [0, 0, collections]
    assert recorder.seconds[2] == collections * 0.5


@pytest.mark.parametrize("generation", [0, 1, 2])
def test_callback_does_not_emit_metrics(
    module_state: tuple[mock.MagicMock, mock.MagicMock], generation: int
) -> None:
    recorder = install_without_thread()
    with mock.patch("sentry.utils.metrics.backend") as backend:
        gc.collect(generation)

    assert backend.mock_calls == []
    assert recorder.counts[generation] >= 1


def test_collection_does_not_wait_for_emit_lock(
    module_state: tuple[mock.MagicMock, mock.MagicMock],
) -> None:
    install_without_thread()
    held = threading.Event()
    release = threading.Event()
    collected = threading.Event()

    def hold_lock() -> None:
        with gc_metrics._lock:
            held.set()
            release.wait(timeout=10)

    def collect() -> None:
        gc.collect()
        collected.set()

    # Collect on a helper thread so a callback that blocks on the lock fails
    # the test within the timeout instead of hanging the main thread.
    holder = threading.Thread(target=hold_lock)
    collector = threading.Thread(target=collect)
    holder.start()
    assert held.wait(timeout=5)
    collector.start()
    try:
        assert collected.wait(timeout=2)
    finally:
        release.set()
        holder.join(timeout=5)
        collector.join(timeout=5)


def test_flush_emits_deltas_unsampled(
    emitted: tuple[mock.MagicMock, mock.MagicMock],
) -> None:
    incr, distribution = emitted
    recorder = GCRecorder()
    reporter = GCReporter(recorder, "main")
    recorder.counts[:] = [3, 0, 1]
    recorder.seconds[:] = [0.25, 0.0, 0.5]
    recorder.samples[:] = [0.5]
    reporter.flush()

    assert incr.call_args_list == [
        mock.call("python.gc.collections", amount=3, tags=tags("0"), sample_rate=1.0),
        mock.call(
            "python.gc.pause_time",
            amount=250,
            tags=tags("0"),
            unit="millisecond",
            sample_rate=1.0,
        ),
        mock.call("python.gc.collections", amount=1, tags=tags("2"), sample_rate=1.0),
        mock.call(
            "python.gc.pause_time",
            amount=500,
            tags=tags("2"),
            unit="millisecond",
            sample_rate=1.0,
        ),
    ]
    assert distribution.call_args_list == [
        mock.call("python.gc.pause", 500.0, tags=tags("2"), unit="millisecond", sample_rate=1.0)
    ]


def test_flush_without_new_collections_emits_nothing(
    emitted: tuple[mock.MagicMock, mock.MagicMock],
) -> None:
    incr, distribution = emitted
    recorder = GCRecorder()
    reporter = GCReporter(recorder, "main")
    recorder.counts[2] = 1
    recorder.seconds[2] = 0.5
    recorder.samples.append(0.5)
    reporter.flush()
    incr.reset_mock()
    distribution.reset_mock()
    reporter.flush()

    assert incr.call_args_list == []
    assert distribution.call_args_list == []
    assert recorder.samples == []


def test_flush_carries_fractional_milliseconds(
    emitted: tuple[mock.MagicMock, mock.MagicMock],
) -> None:
    incr, _ = emitted
    recorder = GCRecorder()
    reporter = GCReporter(recorder, "main")
    recorder.seconds[0] += 0.7e-3
    reporter.flush()
    recorder.seconds[0] += 0.7e-3
    reporter.flush()
    recorder.seconds[0] += 0.7e-3
    reporter.flush()

    # 2.1 ms in total. Truncating each delta would have reported nothing.
    pause_time = mock.call(
        "python.gc.pause_time", amount=1, tags=tags("0"), unit="millisecond", sample_rate=1.0
    )
    assert incr.call_args_list == [pause_time, pause_time]


def test_flush_holds_lock_while_emitting(
    module_state: tuple[mock.MagicMock, mock.MagicMock],
) -> None:
    locked: list[bool] = []
    reporter = mock.Mock(spec=GCReporter)
    reporter.flush.side_effect = lambda: locked.append(gc_metrics._lock.locked())
    gc_metrics._reporter = reporter
    gc_metrics._flush()

    assert locked == [True]


def test_drain_keeps_sample_appended_mid_drain() -> None:
    class AppendsBeforeDelete(list[float]):
        def __delitem__(self, index: SupportsIndex | slice) -> None:
            self.append(9.0)
            super().__delitem__(index)

    samples = AppendsBeforeDelete([1.0, 2.0])

    assert gc_metrics._drain(samples) == [1.0, 2.0]
    assert samples == [9.0]


@pytest.mark.parametrize("value", ["1", "true", "TRUE", " yes ", "y", "t", "on"])
def test_is_enabled(value: str) -> None:
    with mock.patch.dict(os.environ, {gc_metrics.ENV_VAR: value}):
        assert gc_metrics.is_enabled()


def test_install(module_state: tuple[mock.MagicMock, mock.MagicMock]) -> None:
    register_at_fork, atexit_register = module_state
    callbacks = len(gc.callbacks)
    with mock.patch.dict(os.environ, ENABLED):
        gc_metrics.install()
        gc_metrics.install()

    assert gc_metrics._reporter is not None
    assert gc.callbacks[callbacks:] == [gc_metrics._reporter.recorder.callback]
    register_at_fork.assert_called_once_with(
        before=gc_metrics._before_fork,
        after_in_parent=gc_metrics._after_fork_in_parent,
        after_in_child=gc_metrics._after_fork_in_child,
    )
    atexit_register.assert_called_once_with(gc_metrics._flush)
    [thread] = flusher_threads()
    assert thread.daemon

    gc_metrics._stop.set()
    thread.join(timeout=5)

    assert not thread.is_alive()


@pytest.mark.parametrize("value", ["0", "", "nope"])
def test_install_disabled(module_state: tuple[mock.MagicMock, mock.MagicMock], value: str) -> None:
    register_at_fork, atexit_register = module_state
    callbacks = gc.callbacks[:]
    with mock.patch.dict(os.environ, {gc_metrics.ENV_VAR: value}):
        gc_metrics.install()

    assert gc_metrics._reporter is None
    assert gc.callbacks == callbacks
    assert flusher_threads() == []
    assert register_at_fork.call_count == 0
    assert atexit_register.call_count == 0


def test_install_unset(module_state: tuple[mock.MagicMock, mock.MagicMock]) -> None:
    callbacks = gc.callbacks[:]
    with mock.patch.dict(os.environ):
        os.environ.pop(gc_metrics.ENV_VAR, None)
        gc_metrics.install()

    assert gc_metrics._reporter is None
    assert gc.callbacks == callbacks
    assert flusher_threads() == []


@pytest.mark.parametrize(("parent", "process"), [(None, "main"), (object(), "child")])
def test_install_tags_process(
    module_state: tuple[mock.MagicMock, mock.MagicMock], parent: object, process: str
) -> None:
    with (
        mock.patch.dict(os.environ, ENABLED),
        mock.patch.object(multiprocessing, "parent_process", return_value=parent),
        mock.patch.object(gc_metrics, "_start_thread"),
    ):
        gc_metrics.install()

    assert gc_metrics._reporter is not None
    assert gc_metrics._reporter.process == process


def test_thread_flushes_periodically(
    module_state: tuple[mock.MagicMock, mock.MagicMock],
    emitted: tuple[mock.MagicMock, mock.MagicMock],
) -> None:
    incr, _ = emitted
    flushed = threading.Event()
    incr.side_effect = lambda *args, **kwargs: flushed.set()
    with (
        mock.patch.dict(os.environ, ENABLED),
        mock.patch.object(gc_metrics, "FLUSH_INTERVAL", 0.01),
    ):
        gc_metrics.install()
        gc.collect()

        assert flushed.wait(timeout=5)
        [thread] = flusher_threads()
        gc_metrics._stop.set()
        thread.join(timeout=5)
        assert not thread.is_alive()


def test_before_fork_holds_lock_until_parent_resumes(
    module_state: tuple[mock.MagicMock, mock.MagicMock],
) -> None:
    reporter = GCReporter(GCRecorder(), "main")
    gc_metrics._reporter = reporter
    lock = gc_metrics._lock
    gc_metrics._before_fork()

    assert lock.locked()

    gc_metrics._after_fork_in_parent()

    assert not lock.locked()
    assert gc_metrics._lock is lock
    assert gc_metrics._reporter is reporter
    assert reporter.process == "main"
    assert flusher_threads() == []


def test_after_fork_in_child(
    module_state: tuple[mock.MagicMock, mock.MagicMock],
    emitted: tuple[mock.MagicMock, mock.MagicMock],
) -> None:
    incr, distribution = emitted
    recorder = GCRecorder()
    reporter = GCReporter(recorder, "main")
    gc_metrics._reporter = reporter
    recorder.counts[2] = 1
    recorder.seconds[2] = 0.5
    recorder.samples.append(0.5)
    parent_stop = gc_metrics._stop
    gc_metrics._before_fork()
    gc_metrics._after_fork_in_child()

    assert reporter.process == "child"
    assert not gc_metrics._lock.locked()
    assert gc_metrics._stop is not parent_stop
    assert recorder.samples == []
    [thread] = flusher_threads()

    reporter.flush()

    assert incr.call_args_list == []
    assert distribution.call_args_list == []

    gc_metrics._stop.set()
    thread.join(timeout=5)

    assert not thread.is_alive()
