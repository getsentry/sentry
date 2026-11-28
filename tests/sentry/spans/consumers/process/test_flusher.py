from __future__ import annotations

import gc
import re
import threading
import time
import weakref
from collections.abc import Callable, Iterator, Mapping, Sequence
from concurrent.futures import Future
from contextlib import contextmanager
from multiprocessing.process import BaseProcess
from multiprocessing.sharedctypes import Synchronized
from time import sleep
from types import SimpleNamespace
from typing import Any, cast
from unittest import mock

import orjson
import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.processing.strategies.abstract import MessageRejected
from arroyo.processing.strategies.batching import ValuesBatch
from arroyo.processing.strategies.noop import Noop
from arroyo.types import FILTERED_PAYLOAD, Message, Value

from sentry.models.project import Project
from sentry.spans.buffer import SpansBuffer
from sentry.spans.buffer_types import FlushedSegment, OutputSpan, Span
from sentry.spans.consumers.process.flusher import ProduceToPipe, SpanFlusher
from sentry.spans.segment_key import SegmentKey
from sentry.testutils.helpers.options import override_options
from tests.sentry.spans.test_buffer import DEFAULT_OPTIONS


def _payload(span_id: str) -> bytes:
    return orjson.dumps({"span_id": span_id})


def _buffer_with_segment(
    *,
    project_id: int = 999_002,
    trace_id: str = "9" * 32,
    span_id: str = "b" * 16,
    slice_id: int = 999_002,
) -> SpansBuffer:
    buffer = SpansBuffer(assigned_shards=[0], slice_id=slice_id)
    buffer.process_spans(
        [
            Span(
                payload=_payload(span_id),
                trace_id=trace_id,
                span_id=span_id,
                parent_span_id=None,
                segment_id=None,
                is_segment_span=True,
                project_id=project_id,
                partition=0,
            )
        ],
        now=0,
    )
    return buffer


def _blocking_main_for_join_test(
    buffer: SpansBuffer,
    shards: list[int],
    stopped: Synchronized[int],
    current_drift: Synchronized[int],
    drift_initialized: Synchronized[int],
    backpressure_since: Synchronized[int],
    healthy_since: Synchronized[int],
    produce_to_pipe: ProduceToPipe | None,
    wait_for_drift_seconds: int = 0,
    first_cycle_done: Synchronized[int] | None = None,
) -> None:
    """Module-level function for multiprocessing (must be picklable)."""
    healthy_since.value = int(time.time())
    # Block ignoring stopped to simulate stuck I/O (e.g., blocked on Kafka produce)
    while True:
        sleep(0.1)


@override_options({**DEFAULT_OPTIONS, "spans.buffer.flusher.log-flushed-segments": True})
def test_flusher_logs_flushed_segments() -> None:
    project_id = 999_002
    trace_id = "9" * 32
    span_id = "b" * 16
    slice_id = 999_002
    segment_key = f"span-buf:s:{{{project_id}:{trace_id}}}:{span_id}".encode()
    queue_key = f"span-buf:q:{slice_id}-0".encode()
    buffer = _buffer_with_segment(
        project_id=project_id, trace_id=trace_id, span_id=span_id, slice_id=slice_id
    )
    stopped = cast("Synchronized[int]", SimpleNamespace(value=0))
    current_drift = cast("Synchronized[int]", SimpleNamespace(value=0))
    drift_initialized = cast("Synchronized[int]", SimpleNamespace(value=0))
    backpressure_since = cast("Synchronized[int]", SimpleNamespace(value=0))
    healthy_since = cast("Synchronized[int]", SimpleNamespace(value=0))
    produced: list[tuple[int, Any, int]] = []

    def produce_to_pipe(project_id: int, payload: Any, dropped: int) -> None:
        produced.append((project_id, payload, dropped))
        stopped.value = 1

    with mock.patch("sentry.spans.consumers.process.flusher.logger") as mock_logger:
        SpanFlusher.main(
            buffer,
            shards=[0],
            stopped=stopped,
            current_drift=current_drift,
            drift_initialized=drift_initialized,
            backpressure_since=backpressure_since,
            healthy_since=healthy_since,
            produce_to_pipe=produce_to_pipe,
        )

    mock_logger.info.assert_any_call(
        "spans.buffer.flushed_segment",
        extra={
            "segment_key": segment_key.decode("utf-8"),
            "queue_key": queue_key.decode("utf-8"),
            "span_count": 1,
            "project_id": project_id,
        },
    )
    assert len(produced) == 1
    assert produced[0][0] == project_id
    assert produced[0][2] == 1
    assert orjson.loads(produced[0][1].value)["spans"][0]["span_id"] == span_id
    assert buffer.client.zscore(queue_key, segment_key) is None
    assert not buffer.client.keys(f"*{project_id}:{trace_id}*")


@override_options(DEFAULT_OPTIONS)
def test_flusher_produces_flushed_segments_to_process_segment_task() -> None:
    project_id = 999_002
    trace_id = "9" * 32
    span_id = "c" * 16
    slice_id = 999_002
    segment_key = f"span-buf:s:{{{project_id}:{trace_id}}}:{span_id}".encode()
    queue_key = f"span-buf:q:{slice_id}-0".encode()
    buffer = _buffer_with_segment(
        project_id=project_id, trace_id=trace_id, span_id=span_id, slice_id=slice_id
    )
    stopped = cast("Synchronized[int]", SimpleNamespace(value=0))
    current_drift = cast("Synchronized[int]", SimpleNamespace(value=0))
    drift_initialized = cast("Synchronized[int]", SimpleNamespace(value=0))
    backpressure_since = cast("Synchronized[int]", SimpleNamespace(value=0))
    healthy_since = cast("Synchronized[int]", SimpleNamespace(value=0))
    task_future = mock.Mock()

    def wait_for_task_delivery() -> None:
        assert buffer.client.zscore(queue_key, segment_key) is not None

    task_future.result.side_effect = wait_for_task_delivery

    def apply_async_with_future(*args: Any, **kwargs: Any) -> Any:
        stopped.value = 1
        return task_future

    with mock.patch(
        "sentry.spans.consumers.process.flusher.process_segment_task.apply_async_with_future",
        side_effect=apply_async_with_future,
    ) as mock_apply_async_with_future:
        SpanFlusher.main(
            buffer,
            shards=[0],
            stopped=stopped,
            current_drift=current_drift,
            drift_initialized=drift_initialized,
            backpressure_since=backpressure_since,
            healthy_since=healthy_since,
            produce_to_pipe=None,
        )

    mock_apply_async_with_future.assert_called_once()
    task_args = mock_apply_async_with_future.call_args.kwargs["args"]
    task_headers = mock_apply_async_with_future.call_args.kwargs["headers"]
    assert len(task_args) == 1
    assert orjson.loads(task_args[0])["spans"][0]["span_id"] == span_id
    assert task_headers == {"sentry-propagate-traces": False}
    task_future.result.assert_called_once_with()
    assert buffer.client.zscore(queue_key, segment_key) is None


@override_options({**DEFAULT_OPTIONS, "spans.buffer.max-flush-segments": 1})
def test_backpressure() -> None:
    # Flush very aggressively to make join() faster
    with mock.patch("time.sleep"):
        messages = []

        def append(msg: object) -> None:
            messages.append(msg)
            sleep(1.0)

        buffer = SpansBuffer(assigned_shards=list(range(1)))
        flusher = SpanFlusher(
            buffer,
            next_step=Noop(),
            produce_to_pipe=lambda project_id, payload, dropped: append(
                (project_id, payload, dropped)
            ),
        )

        try:
            now = time.time()

            for i in range(200):
                trace_id = f"{i:0>32x}"

                spans = [
                    Span(
                        payload=_payload("a" * 16),
                        trace_id=trace_id,
                        span_id="a" * 16,
                        parent_span_id="b" * 16,
                        segment_id=None,
                        project_id=1,
                    ),
                    Span(
                        payload=_payload("d" * 16),
                        trace_id=trace_id,
                        span_id="d" * 16,
                        parent_span_id="b" * 16,
                        segment_id=None,
                        project_id=1,
                    ),
                    Span(
                        payload=_payload("c" * 16),
                        trace_id=trace_id,
                        span_id="c" * 16,
                        parent_span_id="b" * 16,
                        segment_id=None,
                        project_id=1,
                    ),
                    Span(
                        payload=_payload("b" * 16),
                        trace_id=trace_id,
                        span_id="b" * 16,
                        parent_span_id=None,
                        is_segment_span=True,
                        segment_id=None,
                        project_id=1,
                    ),
                ]

                buffer.process_spans(spans, now=int(now))

            # Advance drift to trigger idle timeout of all segments. The flusher should
            # have way too much to do due to `max_flush_segments=1` and enter
            # backpressure state.

            flusher.current_drift.value = 20000
            sleep(0.1)

            assert messages

            assert any(x.value for x in flusher.process_backpressure_since.values())
        finally:
            flusher.join()


def test_flusher_waits_for_exited_processes_during_startup() -> None:
    """Test that the flusher waits for all processes to become healthy during initialization."""
    buffer = SpansBuffer(assigned_shards=[0])

    # exit without setting healthy_since, simulating a process that fails early
    def never_healthy_main(
        buffer: SpansBuffer,
        shards: list[int],
        stopped: Synchronized[int],
        current_drift: Synchronized[int],
        drift_initialized: Synchronized[int],
        backpressure_since: Synchronized[int],
        healthy_since: Synchronized[int],
        produce_to_pipe: ProduceToPipe | None,
        wait_for_drift_seconds: int = 0,
        first_cycle_done: Synchronized[int] | None = None,
    ) -> None:
        return

    with (
        mock.patch.object(SpanFlusher, "main", never_healthy_main),
        override_options(
            {
                "spans.buffer.flusher.max-unhealthy-seconds": 0.5,
                "spans.buffer.flusher.use-stuck-detector": False,
                "spans.buffer.flusher.wait-for-drift-seconds": 0,
            }
        ),
        pytest.raises(RuntimeError, match="process 0 \\(shards \\[0\\]\\) exited during startup"),
    ):
        SpanFlusher(
            buffer,
            next_step=Noop(),
            produce_to_pipe=lambda project_id, payload, dropped: None,
        )


def test_flusher_timeout_waiting_for_processes_startup() -> None:
    """Test that the flusher times out when a process stays alive but never becomes healthy."""
    buffer = SpansBuffer(assigned_shards=[0])

    # block without setting healthy_since, simulating a process that hangs during startup
    def hang_main(
        buffer: SpansBuffer,
        shards: list[int],
        stopped: Synchronized[int],
        current_drift: Synchronized[int],
        drift_initialized: Synchronized[int],
        backpressure_since: Synchronized[int],
        healthy_since: Synchronized[int],
        produce_to_pipe: ProduceToPipe | None,
        wait_for_drift_seconds: int = 0,
        first_cycle_done: Synchronized[int] | None = None,
    ) -> None:
        while not stopped.value:
            sleep(0.05)

    with (
        mock.patch.object(SpanFlusher, "main", hang_main),
        override_options(
            {
                "spans.buffer.flusher.max-unhealthy-seconds": 0.5,
                "spans.buffer.flusher.use-stuck-detector": False,
                "spans.buffer.flusher.wait-for-drift-seconds": 0,
            }
        ),
        pytest.raises(RuntimeError, match="process 0 \\(shards \\[0\\]\\) didn't start up"),
    ):
        SpanFlusher(
            buffer,
            next_step=Noop(),
            produce_to_pipe=lambda project_id, payload, dropped: None,
        )


def _held_batch() -> Message[ValuesBatch[tuple[int, KafkaPayload]]]:
    """A batch from partitions 100 to 300 seconds behind, the oldest in the middle."""
    now = int(time.time())
    batch: ValuesBatch[tuple[int, KafkaPayload]] = [
        Value((now - lag, KafkaPayload(None, b"", [])), {}) for lag in (200, 300, 100)
    ]
    return Message(Value(batch, {}))


def _hold_until_released(
    flusher: SpanFlusher,
    message: Message[ValuesBatch[tuple[int, KafkaPayload]]],
    timeout: float = 10,
) -> ValuesBatch[tuple[int, KafkaPayload]]:
    """Call hold_first_batch like arroyo does: retry while it rejects the batch."""
    deadline = time.monotonic() + timeout
    while True:
        try:
            return flusher.hold_first_batch(message)
        except MessageRejected:
            if time.monotonic() > deadline:
                raise
            sleep(0.05)


def _reject_until(
    flusher: SpanFlusher,
    message: Message[ValuesBatch[tuple[int, KafkaPayload]]],
    condition: Callable[[], bool],
    timeout: float = 10,
) -> None:
    """Call hold_first_batch, which must reject the batch every time, until condition() holds."""
    deadline = time.monotonic() + timeout
    while not condition():
        assert time.monotonic() < deadline, "timed out"
        with pytest.raises(MessageRejected):
            flusher.hold_first_batch(message)
        sleep(0.05)


# What a fake flusher process does once the drift is set, given its stopped,
# healthy_since and first_cycle_done values.
type _AfterDrift = Callable[[Synchronized[int], Synchronized[int], Synchronized[int]], None]


def _exit_in_first_cycle(
    stopped: Synchronized[int],
    healthy_since: Synchronized[int],
    first_cycle_done: Synchronized[int],
) -> None:
    """Exit, as on a crash, before the first flush cycle has finished."""


def _hang_in_first_cycle(
    stopped: Synchronized[int],
    healthy_since: Synchronized[int],
    first_cycle_done: Synchronized[int],
) -> None:
    """Hang in the first flush cycle, without reporting healthy."""
    while not stopped.value:
        sleep(0.05)


def _exit_after_first_cycle(
    stopped: Synchronized[int],
    healthy_since: Synchronized[int],
    first_cycle_done: Synchronized[int],
) -> None:
    """Finish the first flush cycle, then exit."""
    first_cycle_done.value = 1


def _finish_first_cycle_when(event: threading.Event) -> _AfterDrift:
    """Finish the first flush cycle once `event` is set, then keep running."""

    def after_drift(
        stopped: Synchronized[int],
        healthy_since: Synchronized[int],
        first_cycle_done: Synchronized[int],
    ) -> None:
        while not stopped.value and not event.is_set():
            healthy_since.value = int(time.time())
            sleep(0.05)
        first_cycle_done.value = 1
        while not stopped.value:
            healthy_since.value = int(time.time())
            sleep(0.05)

    return after_drift


def _finish_first_cycle_at_once() -> _AfterDrift:
    event = threading.Event()
    event.set()
    return _finish_first_cycle_when(event)


@contextmanager
def _flusher_with_fake_main(
    shards: list[int],
    after_drift: Mapping[tuple[int, ...], Sequence[_AfterDrift]],
    starts: list[tuple[int, ...]],
) -> Iterator[SpanFlusher]:
    """
    A SpanFlusher with one thread per shard. The n-th thread started for some
    shards waits for the drift, like SpanFlusher._wait_for_drift, and then runs
    after_drift[shards][n]. Each thread appends its shards to `starts`.
    """

    def fake_main(
        buffer: SpansBuffer,
        shards: list[int],
        stopped: Synchronized[int],
        current_drift: Synchronized[int],
        drift_initialized: Synchronized[int],
        backpressure_since: Synchronized[int],
        healthy_since: Synchronized[int],
        produce_to_pipe: ProduceToPipe | None,
        wait_for_drift_seconds: int = 0,
        first_cycle_done: Synchronized[int] | None = None,
    ) -> None:
        # Every process, also a restarted one, gets the value that __init__
        # read.
        assert wait_for_drift_seconds == 60
        assert first_cycle_done is not None
        start = starts.count(tuple(shards))
        starts.append(tuple(shards))
        while not stopped.value and not drift_initialized.value:
            healthy_since.value = int(time.time())
            sleep(0.05)
        after_drift[tuple(shards)][start](stopped, healthy_since, first_cycle_done)

    with (
        mock.patch.object(SpanFlusher, "main", fake_main),
        override_options(
            {
                "spans.buffer.flusher.max-unhealthy-seconds": 1,
                "spans.buffer.flusher.use-stuck-detector": False,
                "spans.buffer.flusher.wait-for-drift-seconds": 60,
            }
        ),
    ):
        flusher = SpanFlusher(
            SpansBuffer(assigned_shards=shards),
            next_step=Noop(),
            produce_to_pipe=lambda project_id, payload, dropped: None,
        )
        try:
            yield flusher
        finally:
            flusher.join()


def test_hold_first_batch_waits_for_every_process() -> None:
    release = threading.Event()
    starts: list[tuple[int, ...]] = []
    after_drift: dict[tuple[int, ...], list[_AfterDrift]] = {
        (0,): [_finish_first_cycle_at_once()],
        (1,): [_finish_first_cycle_when(release)],
    }
    message = _held_batch()

    with _flusher_with_fake_main([0, 1], after_drift, starts) as flusher:
        # The first call sets the drift from the held batch's oldest message,
        # as process_batch() and submit() do, which ends the processes' wait.
        with pytest.raises(MessageRejected):
            flusher.hold_first_batch(message)
        assert flusher.drift_initialized.value == 1
        assert flusher.current_drift.value == pytest.approx(-300, abs=5)

        # Process 0 has finished its first flush cycle, process 1 has not.
        _reject_until(flusher, message, lambda: flusher.process_first_cycle_done[0].value == 1)
        with pytest.raises(MessageRejected):
            flusher.hold_first_batch(message)

        release.set()
        assert _hold_until_released(flusher, message) is message.payload
        assert flusher.process_restarts == {0: 0, 1: 0}
        assert sorted(starts) == [(0,), (1,)]


@pytest.mark.parametrize("exiting_process", [0, 1])
def test_hold_first_batch_raises_if_process_exits_before_first_cycle(
    exiting_process: int,
) -> None:
    starts: list[tuple[int, ...]] = []
    after_drift: dict[tuple[int, ...], list[_AfterDrift]] = {
        (0,): [_finish_first_cycle_at_once()],
        (1,): [_finish_first_cycle_at_once()],
    }
    after_drift[(exiting_process,)] = [_exit_in_first_cycle]
    message = _held_batch()

    with _flusher_with_fake_main([0, 1], after_drift, starts) as flusher:
        with pytest.raises(MessageRejected):
            flusher.hold_first_batch(message)
        flusher.processes[exiting_process].join(5)

        # The consumer stops, as when the startup check fails, and the process
        # is not restarted.
        with pytest.raises(
            RuntimeError,
            match=re.escape(
                f"process {exiting_process} (shards [{exiting_process}]) exited before its first flush cycle"
            ),
        ):
            flusher.hold_first_batch(message)
        assert flusher.process_restarts == {0: 0, 1: 0}
        assert sorted(starts) == [(0,), (1,)]


def _first_rejection(
    flusher: SpanFlusher, message: Message[ValuesBatch[tuple[int, KafkaPayload]]]
) -> tuple[float, float]:
    """
    Make the first hold_first_batch call, which must reject the batch. Returns
    the monotonic times from just before and just after it.
    """
    before = time.monotonic()
    with pytest.raises(MessageRejected):
        flusher.hold_first_batch(message)
    return before, time.monotonic()


def _assert_held_until_restarted_process_finishes(
    flusher: SpanFlusher,
    message: Message[ValuesBatch[tuple[int, KafkaPayload]]],
    release: threading.Event,
    mock_metrics: mock.MagicMock,
    first_rejection: tuple[float, float],
) -> None:
    _reject_until(flusher, message, lambda: flusher.process_restarts[0] == 1)
    # The new process has not finished its own first flush cycle yet.
    with pytest.raises(MessageRejected):
        flusher.hold_first_batch(message)

    released_from = time.monotonic()
    release.set()
    assert _hold_until_released(flusher, message) is message.payload
    released_by = time.monotonic()
    # Later batches pass through, and the hold is timed once, from the first
    # call to the release.
    assert flusher.hold_first_batch(message) is message.payload
    assert flusher.hold_first_batch(message) is message.payload
    hold_timings = [
        call.args[1]
        for call in mock_metrics.timing.call_args_list
        if call.args[0] == "spans.buffer.flusher.hold_first_batch"
    ]
    assert len(hold_timings) == 1
    first_call_from, first_call_by = first_rejection
    assert released_from - first_call_by <= hold_timings[0] <= released_by - first_call_from
    assert flusher.process_restarts[0] == 1


def test_hold_first_batch_restarts_process_that_exits_after_first_cycle() -> None:
    release = threading.Event()
    starts: list[tuple[int, ...]] = []
    after_drift: dict[tuple[int, ...], list[_AfterDrift]] = {
        (0,): [_exit_after_first_cycle, _finish_first_cycle_when(release)]
    }
    message = _held_batch()

    with (
        _flusher_with_fake_main([0], after_drift, starts) as flusher,
        mock.patch("sentry.spans.consumers.process.flusher.metrics") as mock_metrics,
    ):
        first_rejection = _first_rejection(flusher, message)
        flusher.processes[0].join(5)

        _assert_held_until_restarted_process_finishes(
            flusher, message, release, mock_metrics, first_rejection
        )
        assert starts == [(0,), (0,)]


def test_hold_first_batch_restarts_process_that_hangs_in_first_cycle() -> None:
    release = threading.Event()
    starts: list[tuple[int, ...]] = []
    after_drift: dict[tuple[int, ...], list[_AfterDrift]] = {
        (0,): [_hang_in_first_cycle, _finish_first_cycle_when(release)]
    }
    message = _held_batch()

    with (
        _flusher_with_fake_main([0], after_drift, starts) as flusher,
        mock.patch("sentry.spans.consumers.process.flusher.metrics") as mock_metrics,
    ):
        first_rejection = _first_rejection(flusher, message)
        # The process is restarted once it has not reported healthy for
        # max-unhealthy-seconds.
        _assert_held_until_restarted_process_finishes(
            flusher, message, release, mock_metrics, first_rejection
        )
        assert starts == [(0,), (0,)]


def test_flusher_join_timeout_kills_all_processes() -> None:
    """Test that all flusher processes are killed even if join times out.

    Reproduces a bug where hitting the join timeout would break out of the loop
    early, without calling kill() on remaining processes.
    """
    import multiprocessing
    import multiprocessing.process

    buffer = SpansBuffer(assigned_shards=[0, 1, 2])

    # Track which process indices had kill() called
    kill_called_for: set[int] = set()
    flusher: SpanFlusher | None = None  # Will be set below, needed for patched_kill closure

    # Patch BaseProcess.kill to track calls (SpawnProcess inherits from this)
    original_kill = multiprocessing.process.BaseProcess.kill

    def patched_kill(self: BaseProcess) -> None:
        # Find which process_index this is
        if flusher is not None:
            for idx, proc in flusher.processes.items():
                if proc is self:
                    kill_called_for.add(idx)
                    break
        return original_kill(self)

    with (
        mock.patch.object(SpanFlusher, "main", _blocking_main_for_join_test),
        mock.patch.object(multiprocessing.process.BaseProcess, "kill", patched_kill),
        override_options(
            {
                "spans.buffer.flusher.max-unhealthy-seconds": 10,
                "spans.buffer.flusher.use-stuck-detector": False,
                "spans.buffer.flusher.wait-for-drift-seconds": 0,
            }
        ),
    ):
        # Don't use produce_to_pipe so we get real multiprocessing.Process instances
        flusher = SpanFlusher(
            buffer,
            next_step=Noop(),
            max_processes=3,
        )

        try:
            assert len(flusher.processes) == 3
            for process in flusher.processes.values():
                assert process.is_alive()

            # With 0.01s timeout, next_step.join() consumes it, then we should still
            # iterate through ALL processes and call kill() on each
            flusher.join(timeout=0.01)

            # EXPECTED: kill() should be called on all 3 processes
            assert kill_called_for == {0, 1, 2}, (
                f"kill() should be called on all processes, "
                f"but was only called on: {kill_called_for}"
            )
        finally:
            # Clean up: forcibly kill any leaked processes
            for process in flusher.processes.values():
                assert isinstance(process, multiprocessing.process.BaseProcess)
                if process.is_alive():
                    original_kill(process)


def _shared(value: int = 0) -> Synchronized[int]:
    return cast("Synchronized[int]", SimpleNamespace(value=value))


class _TrackedSpanPayload(dict[str, Any]):
    """A span payload that, unlike a plain dict, can be weakly referenced."""


class _TrackedFlushedSegments(dict[SegmentKey, FlushedSegment]):
    """A flush_segments() result that, unlike a plain dict, can be weakly referenced."""


class _CycleTrackingBuffer:
    """
    Fake SpansBuffer that returns one segment per flush cycle. On each later
    flush_segments() call it records whether anything from the previous cycle
    is still alive, then stops the flusher after `num_cycles` cycles.
    """

    def __init__(self, stopped: Synchronized[int], num_cycles: int) -> None:
        self.stopped = stopped
        self.num_cycles = num_cycles
        self.any_shard_at_limit = False
        self.previous_cycle_refs: list[weakref.ref[Any]] = []
        self.previous_cycle_alive: list[bool] = []
        self.done_cycles = 0

    def flush_segments(self, now: int) -> dict[SegmentKey, FlushedSegment]:
        if self.previous_cycle_refs:
            self.previous_cycle_alive.append(
                any(ref() is not None for ref in self.previous_cycle_refs)
            )

        if len(self.previous_cycle_alive) == self.num_cycles:
            self.stopped.value = 1
            return {}

        span_id = f"{len(self.previous_cycle_alive):016x}"
        payload = _TrackedSpanPayload(span_id=span_id, is_segment=True)
        segments = _TrackedFlushedSegments(
            {
                f"span-buf:s:{{1:{'a' * 32}}}:{span_id}".encode(): FlushedSegment(
                    queue_key=b"span-buf:q:0",
                    spans=[OutputSpan(payload=payload)],
                    project_id=1,
                )
            }
        )
        self.previous_cycle_refs = [weakref.ref(payload), weakref.ref(segments)]
        return segments

    def done_flush_segments(self, segment_keys: dict[SegmentKey, FlushedSegment]) -> None:
        self.done_cycles += 1


def _produce_to_pipe_succeeds(project_id: int, payload: KafkaPayload, dropped: int) -> None:
    pass


def _produce_to_pipe_fails(project_id: int, payload: KafkaPayload, dropped: int) -> None:
    raise RuntimeError("produce failed")


def _task_produce_succeeds(*args: object, **kwargs: object) -> Future[None]:
    future: Future[None] = Future()
    future.set_result(None)
    return future


def _task_produce_fails(*args: object, **kwargs: object) -> Future[None]:
    future: Future[None] = Future()
    future.set_exception(RuntimeError("produce failed"))
    return future


@pytest.mark.parametrize(
    ("produce_to_pipe", "apply_async_with_future", "failed_produces"),
    [
        (_produce_to_pipe_succeeds, _task_produce_succeeds, 0),
        (_produce_to_pipe_fails, _task_produce_succeeds, 2),
        (None, _task_produce_succeeds, 0),
        (None, _task_produce_fails, 2),
    ],
    ids=[
        "produce_to_pipe",
        "produce_to_pipe_failed",
        "process_segment_task",
        "process_segment_task_failed",
    ],
)
@override_options(DEFAULT_OPTIONS)
def test_flusher_releases_previous_cycle_before_next_flush(
    produce_to_pipe: ProduceToPipe | None,
    apply_async_with_future: Callable[..., Future[None]],
    failed_produces: int,
) -> None:
    # During catch-up, flush cycles run back to back at the max-flush-segments
    # cap. If the previous cycle's segments are still alive while the next
    # flush_segments() loads a new batch, peak memory doubles. The cycle must
    # be freed by reference counting: the cyclic GC is disabled here because
    # nothing guarantees that it runs between two flush cycles.
    stopped = _shared()
    buffer = _CycleTrackingBuffer(stopped, num_cycles=2)

    gc.disable()
    try:
        with (
            mock.patch("sentry.spans.consumers.process.flusher.time.sleep"),
            mock.patch(
                "sentry.spans.consumers.process.flusher.process_segment_task.apply_async_with_future",
                side_effect=apply_async_with_future,
            ),
            # pytest's log capture would keep the exceptions' tracebacks alive.
            mock.patch("sentry.spans.consumers.process.flusher.logger") as mock_logger,
            mock.patch.object(
                Project.objects,
                "get_from_cache",
                return_value=SimpleNamespace(organization_id=1),
            ),
            mock.patch("sentry.spans.consumers.process.flusher.track_outcome") as track_outcome,
        ):
            SpanFlusher.main(
                cast(SpansBuffer, buffer),
                shards=[0],
                stopped=stopped,
                current_drift=_shared(),
                drift_initialized=_shared(),
                backpressure_since=_shared(),
                healthy_since=_shared(),
                produce_to_pipe=produce_to_pipe,
            )
    finally:
        gc.enable()

    assert buffer.done_cycles == 2
    assert buffer.previous_cycle_alive == [False, False]
    assert mock_logger.exception.call_count == failed_produces
    assert track_outcome.call_count == failed_produces


class _FakeClock:
    """
    Replaces the flusher module's `time`. sleep() advances the clock and then
    calls `on_sleep`, which stands in for the consumer acting while the
    flusher sleeps.
    """

    def __init__(self, on_sleep: Callable[[], None] | None = None) -> None:
        self.now = 1_000_000.0
        self.sleeps: list[float] = []
        self.on_sleep = on_sleep

    def time(self) -> float:
        return self.now

    def monotonic(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds
        if self.on_sleep is not None:
            self.on_sleep()


class _DriftRecordingBuffer:
    """
    Fake SpansBuffer that counts flush_segments(now=0) calls, which the flusher
    makes to check that flushing works before it waits for the drift. For any
    other call it records the drift (`now` relative to the wall clock) and
    stops the flusher.
    """

    def __init__(self, stopped: Synchronized[int], clock: _FakeClock) -> None:
        self.stopped = stopped
        self.clock = clock
        self.any_shard_at_limit = False
        self.probes = 0
        self.flush_drifts: list[int] = []

    def flush_segments(self, now: int) -> dict[SegmentKey, FlushedSegment]:
        if now == 0:
            self.probes += 1
            return {}
        self.flush_drifts.append(now - int(self.clock.time()))
        self.stopped.value = 1
        return {}

    def done_flush_segments(self, segment_keys: dict[SegmentKey, FlushedSegment]) -> None:
        raise AssertionError("nothing was flushed")


def _run_main_with_fake_clock(
    buffer: _DriftRecordingBuffer,
    *,
    stopped: Synchronized[int],
    current_drift: Synchronized[int],
    drift_initialized: Synchronized[int],
    healthy_since: Synchronized[int],
    wait_for_drift_seconds: int,
    first_cycle_done: Synchronized[int] | None = None,
) -> tuple[mock.MagicMock, mock.MagicMock]:
    with (
        mock.patch("sentry.spans.consumers.process.flusher.time", buffer.clock),
        mock.patch("sentry.spans.consumers.process.flusher.metrics") as mock_metrics,
        mock.patch("sentry.spans.consumers.process.flusher.logger") as mock_logger,
    ):
        SpanFlusher.main(
            cast(SpansBuffer, buffer),
            shards=[0],
            stopped=stopped,
            current_drift=current_drift,
            drift_initialized=drift_initialized,
            backpressure_since=_shared(),
            healthy_since=healthy_since,
            produce_to_pipe=None,
            wait_for_drift_seconds=wait_for_drift_seconds,
            first_cycle_done=first_cycle_done,
        )
    return mock_metrics, mock_logger


@pytest.mark.parametrize(
    ("wait_for_drift_seconds", "drift_already_initialized"),
    [(0, 0), (60, 1)],
    ids=["disabled", "drift_already_initialized"],
)
@override_options(DEFAULT_OPTIONS)
def test_flusher_flushes_without_waiting_for_drift(
    wait_for_drift_seconds: int, drift_already_initialized: int
) -> None:
    # A flusher restarted by _ensure_processes_alive sees drift_initialized
    # already set and must not wait.
    stopped = _shared()
    buffer = _DriftRecordingBuffer(stopped, _FakeClock())

    mock_metrics, _ = _run_main_with_fake_clock(
        buffer,
        stopped=stopped,
        current_drift=_shared(-255 * drift_already_initialized),
        drift_initialized=_shared(drift_already_initialized),
        healthy_since=_shared(),
        wait_for_drift_seconds=wait_for_drift_seconds,
    )

    assert buffer.probes == 0
    assert buffer.flush_drifts == [-255 * drift_already_initialized]
    # Only the sleep after the empty flush cycle.
    assert buffer.clock.sleeps == [1]
    mock_metrics.timing.assert_not_called()


# The option stays at 0: main() uses the value that SpanFlusher.__init__ read.
@override_options(DEFAULT_OPTIONS)
def test_flusher_waits_for_drift_before_first_flush() -> None:
    stopped = _shared()
    current_drift = _shared()
    drift_initialized = _shared()
    healthy_since = _shared()
    first_cycle_done = _shared()
    # (healthy_since, number of probe flushes, number of flushes) seen by the
    # "consumer" while the flusher is waiting.
    seen_while_waiting: list[tuple[int, int, int]] = []

    def consumer() -> None:
        if drift_initialized.value:
            return
        assert first_cycle_done.value == 0
        seen_while_waiting.append((healthy_since.value, buffer.probes, len(buffer.flush_drifts)))
        healthy_since.value = 0
        if len(seen_while_waiting) == 10:
            # The consumer submits its first batch, produced 255 seconds ago.
            current_drift.value = -255
            drift_initialized.value = 1

    buffer = _DriftRecordingBuffer(stopped, _FakeClock(on_sleep=consumer))
    mock_metrics, mock_logger = _run_main_with_fake_clock(
        buffer,
        stopped=stopped,
        current_drift=current_drift,
        drift_initialized=drift_initialized,
        healthy_since=healthy_since,
        wait_for_drift_seconds=60,
        first_cycle_done=first_cycle_done,
    )

    # The consumer holds its first batch until then.
    assert first_cycle_done.value == 1
    # Before waiting, the flusher checked that flushing works, without
    # selecting any segment. While waiting, it kept reporting healthy and did
    # not flush.
    assert len(seen_while_waiting) == 10
    assert all(healthy > 0 for healthy, _, _ in seen_while_waiting)
    assert all(probes == 1 for _, probes, _ in seen_while_waiting)
    assert all(flushes == 0 for _, _, flushes in seen_while_waiting)
    # The first flush uses the consumer's drift.
    assert buffer.probes == 1
    assert buffer.flush_drifts == [-255]
    mock_metrics.timing.assert_called_once_with(
        "spans.buffer.flusher.wait_for_drift",
        pytest.approx(1.0),
        tags={"timed_out": "false"},
    )
    mock_logger.info.assert_any_call(
        "spans.buffer.flusher.wait_for_drift.done",
        extra={"shards": "0", "waited_seconds": 1.0, "timed_out": False, "drift": -255},
    )


@override_options(DEFAULT_OPTIONS)
def test_flusher_wait_for_drift_times_out() -> None:
    stopped = _shared()
    healthy_since = _shared()
    seen_while_waiting: list[tuple[int, int, int]] = []

    def consumer() -> None:
        # No message arrives, e.g. on an idle topic.
        seen_while_waiting.append((healthy_since.value, buffer.probes, len(buffer.flush_drifts)))
        healthy_since.value = 0

    buffer = _DriftRecordingBuffer(stopped, _FakeClock(on_sleep=consumer))
    mock_metrics, mock_logger = _run_main_with_fake_clock(
        buffer,
        stopped=stopped,
        current_drift=_shared(),
        drift_initialized=_shared(),
        healthy_since=healthy_since,
        wait_for_drift_seconds=2,
    )

    # The wait loop's sleeps, then the sleep after the empty flush cycle.
    waiting = seen_while_waiting[:-1]
    assert len(waiting) >= 19
    assert all(healthy > 0 for healthy, _, _ in waiting)
    assert all(probes == 1 for _, probes, _ in waiting)
    assert all(flushes == 0 for _, _, flushes in waiting)
    # After the timeout, the flusher flushes with wall-clock time.
    assert buffer.probes == 1
    assert buffer.flush_drifts == [0]
    mock_metrics.timing.assert_called_once_with(
        "spans.buffer.flusher.wait_for_drift",
        pytest.approx(2.0, abs=0.1),
        tags={"timed_out": "true"},
    )
    mock_logger.info.assert_any_call(
        "spans.buffer.flusher.wait_for_drift.done",
        extra={"shards": "0", "waited_seconds": mock.ANY, "timed_out": True, "drift": 0},
    )


@override_options(DEFAULT_OPTIONS)
def test_flusher_stopped_while_waiting_for_drift() -> None:
    stopped = _shared()

    def consumer() -> None:
        # The consumer shuts down before submitting any message.
        stopped.value = 1

    buffer = _DriftRecordingBuffer(stopped, _FakeClock(on_sleep=consumer))
    mock_metrics, mock_logger = _run_main_with_fake_clock(
        buffer,
        stopped=stopped,
        current_drift=_shared(),
        drift_initialized=_shared(),
        healthy_since=_shared(),
        wait_for_drift_seconds=60,
    )

    assert buffer.clock.sleeps == [0.1]
    assert buffer.probes == 1
    assert buffer.flush_drifts == []
    mock_metrics.timing.assert_not_called()
    assert (
        mock.call("spans.buffer.flusher.wait_for_drift.done", extra=mock.ANY)
        not in mock_logger.info.call_args_list
    )


@pytest.mark.parametrize("wait_for_drift_seconds", [0, 60], ids=["disabled", "enabled"])
# The flusher thread's exception is expected.
@pytest.mark.filterwarnings("ignore::pytest.PytestUnhandledThreadExceptionWarning")
def test_flusher_fails_startup_if_flushing_fails(wait_for_drift_seconds: int) -> None:
    # __init__ blocks the consumer until each flusher process is healthy, so
    # that a flusher that cannot flush stops the consumer before it writes
    # into Redis. Waiting for the drift must keep that guarantee.
    buffer = SpansBuffer(assigned_shards=[0])

    with (
        override_options(
            {
                **DEFAULT_OPTIONS,
                "spans.buffer.flusher.wait-for-drift-seconds": wait_for_drift_seconds,
            }
        ),
        mock.patch.object(SpansBuffer, "flush_segments", side_effect=RuntimeError("flush failed")),
        pytest.raises(RuntimeError, match="process 0 \\(shards \\[0\\]\\) exited during startup"),
    ):
        SpanFlusher(
            buffer,
            next_step=Noop(),
            produce_to_pipe=lambda project_id, payload, dropped: None,
        )


@override_options({**DEFAULT_OPTIONS, "spans.buffer.flusher.wait-for-drift-seconds": 60})
def test_flusher_starts_flushing_once_consumer_sets_drift() -> None:
    project_id = 999_003
    slice_id = 999_003
    # This segment is already due by wall-clock time.
    buffer = _buffer_with_segment(project_id=project_id, slice_id=slice_id)
    produced: list[tuple[int, Any, int]] = []

    # __init__ blocks until each flusher process reports healthy. This must
    # not require a flush while the processes wait for the drift.
    flusher = SpanFlusher(
        buffer,
        next_step=Noop(),
        produce_to_pipe=lambda project_id, payload, dropped: produced.append(
            (project_id, payload, dropped)
        ),
    )

    try:
        sleep(0.5)
        assert produced == []
        assert flusher.drift_initialized.value == 0

        # A filtered message carries no timestamp, so it does not set the drift.
        flusher.submit(Message(Value(FILTERED_PAYLOAD, {})))
        assert flusher.drift_initialized.value == 0

        flusher.submit(Message(Value(int(time.time()), {})))
        assert flusher.drift_initialized.value == 1

        deadline = time.time() + 10
        while not produced and time.time() < deadline:
            sleep(0.05)
        assert len(produced) == 1
        assert produced[0][0] == project_id
    finally:
        flusher.join()
