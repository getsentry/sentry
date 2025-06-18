from __future__ import annotations

import itertools
from collections.abc import Sequence
from unittest import mock

import pytest
import rapidjson
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
    return f"span-buf:s:{{{project_id}:{trace_id}}}:{span_id}".encode("ascii")


def _payload(span_id: bytes) -> bytes:
    return rapidjson.dumps({"span_id": span_id}).encode("ascii")


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
                    payload=_payload(b"a" * 16),
                    trace_id="a" * 32,
                    span_id="a" * 16,
                    parent_span_id="b" * 16,
                    project_id=1,
                ),
                Span(
                    payload=_payload(b"d" * 16),
                    trace_id="a" * 32,
                    span_id="d" * 16,
                    parent_span_id="b" * 16,
                    project_id=1,
                ),
                Span(
                    payload=_payload(b"c" * 16),
                    trace_id="a" * 32,
                    span_id="c" * 16,
                    parent_span_id="b" * 16,
                    project_id=1,
                ),
                Span(
                    payload=_payload(b"b" * 16),
                    trace_id="a" * 32,
                    span_id="b" * 16,
                    parent_span_id=None,
                    is_segment_span=True,
                    project_id=1,
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
                    payload=_payload(b"d" * 16),
                    trace_id="a" * 32,
                    span_id="d" * 16,
                    parent_span_id="b" * 16,
                    project_id=1,
                ),
                _SplitBatch(),
                Span(
                    payload=_payload(b"b" * 16),
                    trace_id="a" * 32,
                    span_id="b" * 16,
                    parent_span_id="a" * 16,
                    project_id=1,
                ),
                Span(
                    payload=_payload(b"a" * 16),
                    trace_id="a" * 32,
                    span_id="a" * 16,
                    parent_span_id=None,
                    is_segment_span=True,
                    project_id=1,
                ),
                Span(
                    payload=_payload(b"c" * 16),
                    trace_id="a" * 32,
                    span_id="c" * 16,
                    parent_span_id="a" * 16,
                    project_id=1,
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
                    payload=_payload(b"e" * 16),
                    trace_id="a" * 32,
                    span_id="e" * 16,
                    parent_span_id="d" * 16,
                    project_id=1,
                ),
                Span(
                    payload=_payload(b"d" * 16),
                    trace_id="a" * 32,
                    span_id="d" * 16,
                    parent_span_id="b" * 16,
                    project_id=1,
                ),
                Span(
                    payload=_payload(b"b" * 16),
                    trace_id="a" * 32,
                    span_id="b" * 16,
                    parent_span_id="c" * 16,
                    project_id=1,
                ),
                Span(
                    payload=_payload(b"c" * 16),
                    trace_id="a" * 32,
                    span_id="c" * 16,
                    parent_span_id="a" * 16,
                    project_id=1,
                ),
                Span(
                    payload=_payload(b"a" * 16),
                    trace_id="a" * 32,
                    span_id="a" * 16,
                    parent_span_id=None,
                    is_segment_span=True,
                    project_id=1,
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
                    payload=_payload(b"c" * 16),
                    trace_id="a" * 32,
                    span_id="c" * 16,
                    parent_span_id="b" * 16,
                    project_id=1,
                ),
                Span(
                    payload=_payload(b"d" * 16),
                    trace_id="a" * 32,
                    span_id="d" * 16,
                    parent_span_id="b" * 16,
                    project_id=1,
                ),
                Span(
                    payload=_payload(b"e" * 16),
                    trace_id="a" * 32,
                    span_id="e" * 16,
                    parent_span_id="b" * 16,
                    project_id=1,
                ),
                Span(
                    payload=_payload(b"b" * 16),
                    trace_id="a" * 32,
                    span_id="b" * 16,
                    parent_span_id=None,
                    is_segment_span=True,
                    project_id=2,
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
                payload=_payload(b"c" * 16),
                trace_id="a" * 32,
                span_id="c" * 16,
                parent_span_id="d" * 16,
                project_id=1,
                is_segment_span=True,
            ),
            Span(
                payload=_payload(b"d" * 16),
                trace_id="a" * 32,
                span_id="d" * 16,
                parent_span_id="b" * 16,
                project_id=1,
            ),
            Span(
                payload=_payload(b"e" * 16),
                trace_id="a" * 32,
                span_id="e" * 16,
                parent_span_id="b" * 16,
                project_id=1,
            ),
            Span(
                payload=_payload(b"b" * 16),
                trace_id="a" * 32,
                span_id="b" * 16,
                parent_span_id=None,
                is_segment_span=True,
                project_id=2,
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
            payload=_payload(b"a" * 16),
            trace_id="a" * 32,
            span_id="a" * 16,
            parent_span_id=None,
            project_id=1,
            is_segment_span=True,
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


def test_compression_functionality(buffer):
    """Test that compression is working correctly."""

    def make_payload(span_id: str):
        return rapidjson.dumps(
            {
                "span_id": span_id,
                "trace_id": "a" * 32,
                "data": {"message": "x" * 1000},  # Large payload to compress well
                "extra_data": {"field": "y" * 500},
            }
        ).encode("ascii")

    spans = [
        Span(
            payload=make_payload("b" * 16),
            trace_id="a" * 32,
            span_id="b" * 16,  # This will be the root span
            parent_span_id=None,
            project_id=1,
            is_segment_span=True,
        ),
        Span(
            payload=make_payload("a" * 16),
            trace_id="a" * 32,
            span_id="a" * 16,
            parent_span_id="b" * 16,
            project_id=1,
        ),
        Span(
            payload=make_payload("c" * 16),
            trace_id="a" * 32,
            span_id="c" * 16,
            parent_span_id="b" * 16,
            project_id=1,
        ),
    ]

    # Process spans - should compress them together
    buffer.process_spans(spans, now=0)

    # Verify data is stored (and compressed internally)
    segment_key = _segment_id(1, "a" * 32, "b" * 16)
    stored_data = buffer.client.smembers(segment_key)

    # Should have stored data (compressed or uncompressed fallback)
    assert len(stored_data) > 0

    # Verify we can flush and get back the original data
    segments = buffer.flush_segments(now=11)
    assert len(segments) == 1

    segment = list(segments.values())[0]
    assert len(segment.spans) == 3

    # Verify the payloads are correctly reconstructed
    span_ids = set()
    for span in segment.spans:
        assert "data" in span.payload
        assert "extra_data" in span.payload
        assert span.payload["data"]["message"] == "x" * 1000
        assert span.payload["extra_data"]["field"] == "y" * 500
        span_ids.add(span.payload["span_id"])

    # Verify we got all expected span IDs
    expected_span_ids = {"a" * 16, "b" * 16, "c" * 16}
    assert span_ids == expected_span_ids

    buffer.done_flush_segments(segments)
    assert_clean(buffer.client)


@override_options({"spans.buffer.compression.level": -1})
def test_compression_disabled():
    """Test that compression can be disabled."""
    buffer = SpansBuffer([0])

    # Verify that the compressor is None when compression is disabled
    assert buffer._zstd_compressor is None

    # Test that compression method returns data as-is
    test_payloads = [b"test1", b"test2", b"test3"]
    result = buffer._compress_span_payloads(test_payloads)
    expected = b"\x00".join(test_payloads)
    assert result == expected

    # Test that decompression still works with uncompressed data
    # Note: when compression is disabled, the result is treated as a single payload
    decompressed = buffer._decompress_batch(result)
    assert decompressed == [expected]


@override_options({"spans.buffer.compression.level": 3})
def test_compression_custom_level():
    """Test that custom compression levels work."""
    buffer = SpansBuffer([0])

    # Verify that the compressor is created when compression is enabled
    assert buffer._zstd_compressor is not None

    # Test that compression still works with the custom level
    test_payloads = [b"test1", b"test2", b"test3"]
    result = buffer._compress_span_payloads(test_payloads)
    # Should be compressed (has zstd magic header)
    assert result.startswith(b"\x28\xb5\x2f\xfd")
