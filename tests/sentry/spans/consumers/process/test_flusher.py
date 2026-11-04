from __future__ import annotations

import gc
import time
import weakref
from collections.abc import Callable
from concurrent.futures import Future
from multiprocessing.process import BaseProcess
from multiprocessing.sharedctypes import Synchronized
from time import sleep
from types import SimpleNamespace
from typing import Any, cast
from unittest import mock

import orjson
import pytest
from arroyo.backends.kafka import KafkaPayload
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
    ) -> None:
        return

    with (
        mock.patch.object(SpanFlusher, "main", never_healthy_main),
        override_options(
            {
                "spans.buffer.flusher.max-unhealthy-seconds": 0.5,
                "spans.buffer.flusher.use-stuck-detector": False,
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
    ) -> None:
        while not stopped.value:
            sleep(0.05)

    with (
        mock.patch.object(SpanFlusher, "main", hang_main),
        override_options(
            {
                "spans.buffer.flusher.max-unhealthy-seconds": 0.5,
                "spans.buffer.flusher.use-stuck-detector": False,
            }
        ),
        pytest.raises(RuntimeError, match="process 0 \\(shards \\[0\\]\\) didn't start up"),
    ):
        SpanFlusher(
            buffer,
            next_step=Noop(),
            produce_to_pipe=lambda project_id, payload, dropped: None,
        )


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
        )
    return mock_metrics, mock_logger


@pytest.mark.parametrize(
    ("wait_for_drift_seconds", "drift_already_initialized"),
    [(0, 0), (60, 1)],
    ids=["disabled", "drift_already_initialized"],
)
def test_flusher_flushes_without_waiting_for_drift(
    wait_for_drift_seconds: int, drift_already_initialized: int
) -> None:
    # A flusher restarted by _ensure_processes_alive sees drift_initialized
    # already set and must not wait.
    stopped = _shared()
    buffer = _DriftRecordingBuffer(stopped, _FakeClock())

    with override_options(
        {**DEFAULT_OPTIONS, "spans.buffer.flusher.wait-for-drift-seconds": wait_for_drift_seconds}
    ):
        mock_metrics, _ = _run_main_with_fake_clock(
            buffer,
            stopped=stopped,
            current_drift=_shared(-255 * drift_already_initialized),
            drift_initialized=_shared(drift_already_initialized),
            healthy_since=_shared(),
        )

    assert buffer.probes == 0
    assert buffer.flush_drifts == [-255 * drift_already_initialized]
    # Only the sleep after the empty flush cycle.
    assert buffer.clock.sleeps == [1]
    mock_metrics.timing.assert_not_called()


@override_options({**DEFAULT_OPTIONS, "spans.buffer.flusher.wait-for-drift-seconds": 60})
def test_flusher_waits_for_drift_before_first_flush() -> None:
    stopped = _shared()
    current_drift = _shared()
    drift_initialized = _shared()
    healthy_since = _shared()
    # (healthy_since, number of probe flushes, number of flushes) seen by the
    # "consumer" while the flusher is waiting.
    seen_while_waiting: list[tuple[int, int, int]] = []

    def consumer() -> None:
        if drift_initialized.value:
            return
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
    )

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


@override_options({**DEFAULT_OPTIONS, "spans.buffer.flusher.wait-for-drift-seconds": 2})
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


@override_options({**DEFAULT_OPTIONS, "spans.buffer.flusher.wait-for-drift-seconds": 60})
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
