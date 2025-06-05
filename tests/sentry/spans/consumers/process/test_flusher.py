import time
from time import sleep

import rapidjson
from arroyo.processing.strategies.noop import Noop

from sentry.spans.buffer import Span, SpansBuffer
from sentry.spans.consumers.process.flusher import SpanFlusher


def _payload(span_id: bytes) -> bytes:
    return rapidjson.dumps({"span_id": span_id}).encode("ascii")


def test_backpressure(monkeypatch):
    # Flush very aggressively to make join() faster
    monkeypatch.setattr("time.sleep", lambda _: None)

    buffer = SpansBuffer(
        assigned_shards=list(range(1)),
        max_flush_segments=1,
    )

    messages = []

    def append(msg):
        messages.append(msg)
        sleep(1.0)

    flusher = SpanFlusher(
        buffer,
        max_memory_percentage=1.0,
        produce_to_pipe=append,
        next_step=Noop(),
    )

    now = time.time()

    for i in range(200):
        trace_id = f"{i:0>32x}"

        spans = [
            Span(
                payload=_payload(b"a" * 16),
                trace_id=trace_id,
                span_id="a" * 16,
                parent_span_id="b" * 16,
                project_id=1,
            ),
            Span(
                payload=_payload(b"d" * 16),
                trace_id=trace_id,
                span_id="d" * 16,
                parent_span_id="b" * 16,
                project_id=1,
            ),
            Span(
                payload=_payload(b"c" * 16),
                trace_id=trace_id,
                span_id="c" * 16,
                parent_span_id="b" * 16,
                project_id=1,
            ),
            Span(
                payload=_payload(b"b" * 16),
                trace_id=trace_id,
                span_id="b" * 16,
                parent_span_id=None,
                is_segment_span=True,
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

    assert flusher.backpressure_since.value
