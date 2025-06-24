from __future__ import annotations

import itertools
from collections.abc import Sequence
from unittest import mock

import orjson
import pytest
from sentry_redis_tools.clients import StrictRedis

from sentry.spans.buffer import FlushedSegment, OutputSpan, SegmentKey, Span, SpansBuffer
from sentry.testutils.helpers.options import override_options

DEFAULT_OPTIONS = {
    "spans.buffer.timeout": 60,
    "spans.buffer.root-timeout": 10,
    "spans.buffer.segment-page-size": 100,
    "spans.buffer.max-segment-bytes": 10 * 1024 * 1024,
    "spans.buffer.max-segment-spans": 1001,
    "spans.buffer.redis-ttl": 3600,
    "spans.buffer.max-flush-segments": 500,
    "spans.buffer.max-memory-percentage": 1.0,
    "spans.buffer.flusher.backpressure-seconds": 10,
    "spans.buffer.flusher.max-unhealthy-seconds": 60,
    "spans.buffer.compression.level": 0,
}


def shallow_permutations(spans: list[Span]) -> list[list[Span]]:
    return [
        spans,
        list(reversed(spans)),
        [span_or_split for span in spans for span_or_split in [span, _SplitBatch()]],  # type: ignore[misc]
    ]


def _segment_id(project_id: int, trace_id: str, span_id: str) -> SegmentKey:
    return f"span-buf:z:{{{project_id}:{trace_id}}}:{span_id}".encode("ascii")


def _payload(span_id: str) -> bytes:
    return orjson.dumps({"span_id": span_id})


def _output_segment(span_id: bytes, segment_id: bytes, is_segment: bool) -> OutputSpan:
    return OutputSpan(
        payload={
            "data": {
                "__sentry_internal_span_buffer_outcome": "different",
            },
            "span_id": span_id.decode("ascii"),
            "segment_id": segment_id.decode("ascii"),
            "is_segment": is_segment,
        }
    )


def _normalize_output(output: dict[SegmentKey, FlushedSegment]):
    for segment in output.values():
        segment.spans.sort(key=lambda span: span.payload["span_id"])


@pytest.fixture(params=["cluster", "single"])
def buffer(request):
    with override_options(DEFAULT_OPTIONS):
        if request.param == "cluster":
            from sentry.testutils.helpers.redis import use_redis_cluster

            with use_redis_cluster("default"):
                buf = SpansBuffer(assigned_shards=list(range(32)))
                # since we patch the default redis cluster only temporarily, we
                # need to clean it up ourselves.
                buf.client.flushall()
                yield buf
        else:
            yield SpansBuffer(assigned_shards=list(range(32)))


def assert_ttls(client: StrictRedis[bytes]):
    """
    Check that all keys have a TTL, because if the consumer dies before
    flushing, we should not leak memory.
    """

    for k in client.keys("*"):
        assert client.ttl(k) > -1, k


def assert_clean(client: StrictRedis[bytes]):
    """
    Check that there's no leakage.

    Note: CANNOT be done in pytest fixture as that one runs _after_ redis gets
    wiped by the test harness.
    """
    assert not [x for x in client.keys("*") if b":hrs:" not in x]


class _SplitBatch:
    pass


def process_spans(spans: Sequence[Span | _SplitBatch], buffer: SpansBuffer, now):
    """
    Call buffer.process_spans on the list of spans.

    We get a sequence of spans like this:

        A
        B
        C
        SPLIT
        D

    A, B, C will land in a batch, D will land in its own batch.
    """

    span_chunks: list[list[Span]] = [[]]

    for span in spans:
        if isinstance(span, _SplitBatch):
            if span_chunks[-1]:
                span_chunks.append([])
        else:
            span_chunks[-1].append(span)

    for chunk in span_chunks:
        buffer.process_spans(chunk, now)


@pytest.mark.parametrize(
    "spans",
    list(
        itertools.permutations(
            [
                Span(
                    payload=_payload("a" * 16),
                    trace_id="a" * 32,
                    span_id="a" * 16,
                    parent_span_id="b" * 16,
                    project_id=1,
                    end_timestamp_precise=1700000000.0,
                ),
                Span(
                    payload=_payload("d" * 16),
                    trace_id="a" * 32,
                    span_id="d" * 16,
                    parent_span_id="b" * 16,
                    project_id=1,
                    end_timestamp_precise=1700000000.0,
                ),
                Span(
                    payload=_payload("c" * 16),
                    trace_id="a" * 32,
                    span_id="c" * 16,
                    parent_span_id="b" * 16,
                    project_id=1,
                    end_timestamp_precise=1700000000.0,
                ),
                Span(
                    payload=_payload("b" * 16),
                    trace_id="a" * 32,
                    span_id="b" * 16,
                    parent_span_id=None,
                    is_segment_span=True,
                    project_id=1,
                    end_timestamp_precise=1700000000.0,
                ),
            ]
        )
    ),
)
def test_basic(buffer: SpansBuffer, spans):
    process_spans(spans, buffer, now=0)

    assert_ttls(buffer.client)

    assert buffer.flush_segments(now=5) == {}
    rv = buffer.flush_segments(now=11)
    _normalize_output(rv)
    assert rv == {
        _segment_id(1, "a" * 32, "b" * 16): FlushedSegment(
            queue_key=mock.ANY,
            spans=[
                _output_segment(b"a" * 16, b"b" * 16, False),
                _output_segment(b"b" * 16, b"b" * 16, True),
                _output_segment(b"c" * 16, b"b" * 16, False),
                _output_segment(b"d" * 16, b"b" * 16, False),
            ],
        )
    }
    buffer.done_flush_segments(rv)
    assert buffer.flush_segments(now=30) == {}

    assert list(buffer.get_memory_info())

    assert_clean(buffer.client)


@pytest.mark.parametrize(
    "spans",
    list(
        itertools.permutations(
            [
                Span(
                    payload=_payload("d" * 16),
                    trace_id="a" * 32,
                    span_id="d" * 16,
                    parent_span_id="b" * 16,
                    project_id=1,
                    end_timestamp_precise=1700000000.0,
                ),
                _SplitBatch(),
                Span(
                    payload=_payload("b" * 16),
                    trace_id="a" * 32,
                    span_id="b" * 16,
                    parent_span_id="a" * 16,
                    project_id=1,
                    end_timestamp_precise=1700000000.0,
                ),
                Span(
                    payload=_payload("a" * 16),
                    trace_id="a" * 32,
                    span_id="a" * 16,
                    parent_span_id=None,
                    is_segment_span=True,
                    project_id=1,
                    end_timestamp_precise=1700000000.0,
                ),
                Span(
                    payload=_payload("c" * 16),
                    trace_id="a" * 32,
                    span_id="c" * 16,
                    parent_span_id="a" * 16,
                    project_id=1,
                    end_timestamp_precise=1700000000.0,
                ),
            ]
        )
    ),
)
def test_deep(buffer: SpansBuffer, spans):
    process_spans(spans, buffer, now=0)

    assert_ttls(buffer.client)

    rv = buffer.flush_segments(now=10)
    _normalize_output(rv)
    assert rv == {
        _segment_id(1, "a" * 32, "a" * 16): FlushedSegment(
            queue_key=mock.ANY,
            spans=[
                _output_segment(b"a" * 16, b"a" * 16, True),
                _output_segment(b"b" * 16, b"a" * 16, False),
                _output_segment(b"c" * 16, b"a" * 16, False),
                _output_segment(b"d" * 16, b"a" * 16, False),
            ],
        )
    }

    buffer.done_flush_segments(rv)

    rv = buffer.flush_segments(now=60)
    assert rv == {}

    assert_clean(buffer.client)


@pytest.mark.parametrize(
    "spans",
    list(
        itertools.permutations(
            [
                Span(
                    payload=_payload("e" * 16),
                    trace_id="a" * 32,
                    span_id="e" * 16,
                    parent_span_id="d" * 16,
                    project_id=1,
                    end_timestamp_precise=1700000000.0,
                ),
                Span(
                    payload=_payload("d" * 16),
                    trace_id="a" * 32,
                    span_id="d" * 16,
                    parent_span_id="b" * 16,
                    project_id=1,
                    end_timestamp_precise=1700000000.0,
                ),
                Span(
                    payload=_payload("b" * 16),
                    trace_id="a" * 32,
                    span_id="b" * 16,
                    parent_span_id="c" * 16,
                    project_id=1,
                    end_timestamp_precise=1700000000.0,
                ),
                Span(
                    payload=_payload("c" * 16),
                    trace_id="a" * 32,
                    span_id="c" * 16,
                    parent_span_id="a" * 16,
                    project_id=1,
                    end_timestamp_precise=1700000000.0,
                ),
                Span(
                    payload=_payload("a" * 16),
                    trace_id="a" * 32,
                    span_id="a" * 16,
                    parent_span_id=None,
                    is_segment_span=True,
                    project_id=1,
                    end_timestamp_precise=1700000000.0,
                ),
            ]
        )
    ),
)
def test_deep2(buffer: SpansBuffer, spans):
    process_spans(spans, buffer, now=0)

    assert_ttls(buffer.client)

    rv = buffer.flush_segments(now=10)
    _normalize_output(rv)
    assert rv == {
        _segment_id(1, "a" * 32, "a" * 16): FlushedSegment(
            queue_key=mock.ANY,
            spans=[
                _output_segment(b"a" * 16, b"a" * 16, True),
                _output_segment(b"b" * 16, b"a" * 16, False),
                _output_segment(b"c" * 16, b"a" * 16, False),
                _output_segment(b"d" * 16, b"a" * 16, False),
                _output_segment(b"e" * 16, b"a" * 16, False),
            ],
        )
    }

    buffer.done_flush_segments(rv)

    rv = buffer.flush_segments(now=60)
    assert rv == {}

    assert_clean(buffer.client)


@pytest.mark.parametrize(
    "spans",
    list(
        itertools.permutations(
            [
                Span(
                    payload=_payload("c" * 16),
                    trace_id="a" * 32,
                    span_id="c" * 16,
                    parent_span_id="b" * 16,
                    project_id=1,
                    end_timestamp_precise=1700000000.0,
                ),
                Span(
                    payload=_payload("d" * 16),
                    trace_id="a" * 32,
                    span_id="d" * 16,
                    parent_span_id="b" * 16,
                    project_id=1,
                    end_timestamp_precise=1700000000.0,
                ),
                Span(
                    payload=_payload("e" * 16),
                    trace_id="a" * 32,
                    span_id="e" * 16,
                    parent_span_id="b" * 16,
                    project_id=1,
                    end_timestamp_precise=1700000000.0,
                ),
                Span(
                    payload=_payload("b" * 16),
                    trace_id="a" * 32,
                    span_id="b" * 16,
                    parent_span_id=None,
                    is_segment_span=True,
                    project_id=2,
                    end_timestamp_precise=1700000000.0,
                ),
            ]
        )
    ),
)
def test_parent_in_other_project(buffer: SpansBuffer, spans):
    process_spans(spans, buffer, now=0)

    assert_ttls(buffer.client)

    assert buffer.flush_segments(now=5) == {}
    rv = buffer.flush_segments(now=11)
    assert rv == {
        _segment_id(2, "a" * 32, "b" * 16): FlushedSegment(
            queue_key=mock.ANY, spans=[_output_segment(b"b" * 16, b"b" * 16, True)]
        )
    }
    buffer.done_flush_segments(rv)

    # TODO: flush faster, since we already saw parent in other project
    assert buffer.flush_segments(now=30) == {}
    rv = buffer.flush_segments(now=60)
    _normalize_output(rv)
    assert rv == {
        _segment_id(1, "a" * 32, "b" * 16): FlushedSegment(
            queue_key=mock.ANY,
            spans=[
                _output_segment(b"c" * 16, b"b" * 16, False),
                _output_segment(b"d" * 16, b"b" * 16, False),
                _output_segment(b"e" * 16, b"b" * 16, False),
            ],
        )
    }
    buffer.done_flush_segments(rv)

    assert buffer.flush_segments(now=90) == {}

    assert_clean(buffer.client)


@pytest.mark.parametrize(
    "spans",
    shallow_permutations(
        [
            Span(
                payload=_payload("c" * 16),
                trace_id="a" * 32,
                span_id="c" * 16,
                parent_span_id="d" * 16,
                project_id=1,
                is_segment_span=True,
                end_timestamp_precise=1700000000.0,
            ),
            Span(
                payload=_payload("d" * 16),
                trace_id="a" * 32,
                span_id="d" * 16,
                parent_span_id="b" * 16,
                project_id=1,
                end_timestamp_precise=1700000000.0,
            ),
            Span(
                payload=_payload("e" * 16),
                trace_id="a" * 32,
                span_id="e" * 16,
                parent_span_id="b" * 16,
                project_id=1,
                end_timestamp_precise=1700000000.0,
            ),
            Span(
                payload=_payload("b" * 16),
                trace_id="a" * 32,
                span_id="b" * 16,
                parent_span_id=None,
                is_segment_span=True,
                project_id=2,
                end_timestamp_precise=1700000000.0,
            ),
        ]
    ),
)
def test_parent_in_other_project_and_nested_is_segment_span(buffer: SpansBuffer, spans):
    process_spans(spans, buffer, now=0)

    assert_ttls(buffer.client)

    assert buffer.flush_segments(now=5) == {}
    rv = buffer.flush_segments(now=11)
    assert rv == {
        _segment_id(2, "a" * 32, "b" * 16): FlushedSegment(
            queue_key=mock.ANY, spans=[_output_segment(b"b" * 16, b"b" * 16, True)]
        ),
        _segment_id(1, "a" * 32, "c" * 16): FlushedSegment(
            queue_key=mock.ANY,
            spans=[
                _output_segment(b"c" * 16, b"c" * 16, True),
            ],
        ),
    }
    buffer.done_flush_segments(rv)

    # TODO: flush faster, since we already saw parent in other project
    assert buffer.flush_segments(now=30) == {}
    rv = buffer.flush_segments(now=60)
    _normalize_output(rv)
    assert rv == {
        _segment_id(1, "a" * 32, "b" * 16): FlushedSegment(
            queue_key=mock.ANY,
            spans=[
                _output_segment(b"d" * 16, b"b" * 16, False),
                _output_segment(b"e" * 16, b"b" * 16, False),
            ],
        ),
    }

    buffer.done_flush_segments(rv)

    assert buffer.flush_segments(now=90) == {}

    assert_clean(buffer.client)


def test_flush_rebalance(buffer: SpansBuffer):
    spans = [
        Span(
            payload=_payload("a" * 16),
            trace_id="a" * 32,
            span_id="a" * 16,
            parent_span_id=None,
            project_id=1,
            is_segment_span=True,
            end_timestamp_precise=1700000000.0,
        )
    ]

    process_spans(spans, buffer, now=0)
    assert_ttls(buffer.client)

    assert buffer.flush_segments(now=5) == {}
    rv = buffer.flush_segments(now=11)
    assert rv == {
        _segment_id(1, "a" * 32, "a" * 16): FlushedSegment(
            queue_key=mock.ANY, spans=[_output_segment(b"a" * 16, b"a" * 16, True)]
        ),
    }

    # Clear out assigned shards, simulating a rebalance operation.
    buffer.assigned_shards.clear()
    buffer.done_flush_segments(rv)

    rv = buffer.flush_segments(now=20)
    assert not rv

    assert_clean(buffer.client)


@pytest.mark.parametrize("compression_level", [-1, 0])
def test_compression_functionality(compression_level):
    """Test that compression is working correctly at various compression levels."""
    with override_options({**DEFAULT_OPTIONS, "spans.buffer.compression.level": compression_level}):
        buffer = SpansBuffer(assigned_shards=list(range(32)))

        def make_payload(span_id: str):
            return orjson.dumps(
                {
                    "span_id": span_id,
                    "trace_id": "a" * 32,
                    "data": {"message": "x" * 1000},
                    "extra_data": {"field": "y" * 500},
                }
            )

        spans = [
            Span(
                payload=make_payload("b" * 16),
                trace_id="a" * 32,
                span_id="b" * 16,
                parent_span_id=None,
                project_id=1,
                is_segment_span=True,
                end_timestamp_precise=1700000000.0,
            ),
            Span(
                payload=make_payload("a" * 16),
                trace_id="a" * 32,
                span_id="a" * 16,
                parent_span_id="b" * 16,
                project_id=1,
                end_timestamp_precise=1700000000.0,
            ),
            Span(
                payload=make_payload("c" * 16),
                trace_id="a" * 32,
                span_id="c" * 16,
                parent_span_id="b" * 16,
                project_id=1,
                end_timestamp_precise=1700000000.0,
            ),
        ]

        buffer.process_spans(spans, now=0)

        segment_key = _segment_id(1, "a" * 32, "b" * 16)
        stored_data = buffer.client.zrange(segment_key, 0, -1, withscores=False)
        assert len(stored_data) > 0

        segments = buffer.flush_segments(now=11)
        assert len(segments) == 1

        segment = list(segments.values())[0]
        assert len(segment.spans) == 3

        span_ids = set()
        for span in segment.spans:
            assert "data" in span.payload
            assert "extra_data" in span.payload
            assert span.payload["data"]["message"] == "x" * 1000
            assert span.payload["extra_data"]["field"] == "y" * 500
            span_ids.add(span.payload["span_id"])

        expected_span_ids = {"a" * 16, "b" * 16, "c" * 16}
        assert span_ids == expected_span_ids

        buffer.done_flush_segments(segments)
        assert_clean(buffer.client)
