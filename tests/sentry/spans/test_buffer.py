from __future__ import annotations

import itertools

import pytest
import rapidjson
from sentry_redis_tools.clients import StrictRedis

from sentry.spans.buffer import OutputSpan, SegmentId, Span, SpansBuffer


def shallow_permutations(spans: list[Span]) -> list[list[Span]]:
    return [
        spans,
        list(reversed(spans)),
    ]


def _segment_id(project_id: int, trace_id: str, span_id: str) -> SegmentId:
    return f"span-buf:s:{{{project_id}:{trace_id}}}:{span_id}".encode("ascii")


def _payload(span_id: bytes) -> bytes:
    return rapidjson.dumps({"span_id": span_id}).encode("ascii")


def _output_segment(span_id: bytes, segment_id: bytes, is_segment: bool) -> OutputSpan:
    return OutputSpan(
        payload={
            "span_id": span_id.decode("ascii"),
            "segment_id": segment_id.decode("ascii"),
            "is_segment": is_segment,
        }
    )


def _normalize_output(output: dict[SegmentId, list[OutputSpan]]):
    for segment in output.values():
        segment.sort(key=lambda span: span.payload["span_id"])


@pytest.fixture(params=["cluster", "single"])
def buffer(request):
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
    buffer.process_spans(spans, now=0)

    assert_ttls(buffer.client)

    assert buffer.flush_segments(now=5) == (1, {})
    _, rv = buffer.flush_segments(now=11)
    _normalize_output(rv)
    assert rv == {
        _segment_id(1, "a" * 32, "b" * 16): [
            _output_segment(b"a" * 16, b"b" * 16, False),
            _output_segment(b"b" * 16, b"b" * 16, True),
            _output_segment(b"c" * 16, b"b" * 16, False),
            _output_segment(b"d" * 16, b"b" * 16, False),
        ]
    }
    buffer.done_flush_segments(rv)
    assert buffer.flush_segments(now=30) == (0, {})

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
    buffer.process_spans(spans, now=0)

    assert_ttls(buffer.client)

    _, rv = buffer.flush_segments(now=10)
    _normalize_output(rv)
    assert rv == {
        _segment_id(1, "a" * 32, "a" * 16): [
            _output_segment(b"a" * 16, b"a" * 16, True),
            _output_segment(b"b" * 16, b"a" * 16, False),
            _output_segment(b"c" * 16, b"a" * 16, False),
            _output_segment(b"d" * 16, b"a" * 16, False),
        ]
    }

    buffer.done_flush_segments(rv)

    _, rv = buffer.flush_segments(now=60)
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
    buffer.process_spans(spans, now=0)

    assert_ttls(buffer.client)

    _, rv = buffer.flush_segments(now=10)
    _normalize_output(rv)
    assert rv == {
        _segment_id(1, "a" * 32, "a" * 16): [
            _output_segment(b"a" * 16, b"a" * 16, True),
            _output_segment(b"b" * 16, b"a" * 16, False),
            _output_segment(b"c" * 16, b"a" * 16, False),
            _output_segment(b"d" * 16, b"a" * 16, False),
            _output_segment(b"e" * 16, b"a" * 16, False),
        ]
    }

    buffer.done_flush_segments(rv)

    _, rv = buffer.flush_segments(now=60)
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
    buffer.process_spans(spans, now=0)

    assert_ttls(buffer.client)

    assert buffer.flush_segments(now=5) == (2, {})
    _, rv = buffer.flush_segments(now=11)
    assert rv == {_segment_id(2, "a" * 32, "b" * 16): [_output_segment(b"b" * 16, b"b" * 16, True)]}
    buffer.done_flush_segments(rv)

    # TODO: flush faster, since we already saw parent in other project
    assert buffer.flush_segments(now=30) == (1, {})
    _, rv = buffer.flush_segments(now=60)
    _normalize_output(rv)
    assert rv == {
        _segment_id(1, "a" * 32, "b" * 16): [
            _output_segment(b"c" * 16, b"b" * 16, False),
            _output_segment(b"d" * 16, b"b" * 16, False),
            _output_segment(b"e" * 16, b"b" * 16, False),
        ]
    }
    buffer.done_flush_segments(rv)

    assert buffer.flush_segments(now=90) == (0, {})

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
    buffer.process_spans(spans, now=0)

    assert_ttls(buffer.client)

    assert buffer.flush_segments(now=5) == (3, {})
    _, rv = buffer.flush_segments(now=11)
    assert rv == {
        _segment_id(2, "a" * 32, "b" * 16): [_output_segment(b"b" * 16, b"b" * 16, True)],
        _segment_id(1, "a" * 32, "c" * 16): [
            _output_segment(b"c" * 16, b"c" * 16, True),
        ],
    }
    buffer.done_flush_segments(rv)

    # TODO: flush faster, since we already saw parent in other project
    assert buffer.flush_segments(now=30) == (1, {})
    _, rv = buffer.flush_segments(now=60)
    _normalize_output(rv)
    assert rv == {
        _segment_id(1, "a" * 32, "b" * 16): [
            _output_segment(b"d" * 16, b"b" * 16, False),
            _output_segment(b"e" * 16, b"b" * 16, False),
        ],
    }
    buffer.done_flush_segments(rv)

    assert buffer.flush_segments(now=90) == (0, {})

    assert_clean(buffer.client)
