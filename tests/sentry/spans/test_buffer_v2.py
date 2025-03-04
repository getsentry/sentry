from __future__ import annotations

import pytest
from sentry_redis_tools.clients import StrictRedis

from sentry.spans.buffer_v2 import RedisSpansBufferV2, SegmentId, Span


def _segment_id(project_id: int, trace_id: str, span_id: str) -> SegmentId:
    return f"span-buf:s:{{{project_id}:{trace_id}}}:{span_id}".encode("ascii")


@pytest.fixture(params=["cluster", "single"])
def buffer(request):
    if request.param == "cluster":
        from sentry.testutils.helpers.redis import use_redis_cluster

        with use_redis_cluster("default"):
            buf = RedisSpansBufferV2()
            # since we patch the default redis cluster only temporarily, we
            # need to clean it up ourselves.
            buf.client.flushall()
            yield buf
    else:
        yield RedisSpansBufferV2()


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
    assert not [x for x in client.keys("*") if b":sr:" not in x and b":hrs:" not in x]


def test_basic(buffer: RedisSpansBufferV2):
    spans = [
        Span(
            payload=b"A", trace_id="a" * 32, span_id="c" * 16, parent_span_id="b" * 16, project_id=1
        ),
        Span(
            payload=b"B", trace_id="a" * 32, span_id="d" * 16, parent_span_id="b" * 16, project_id=1
        ),
        Span(
            payload=b"C", trace_id="a" * 32, span_id="e" * 16, parent_span_id="b" * 16, project_id=1
        ),
        Span(payload=b"D", trace_id="a" * 32, span_id="b" * 16, parent_span_id=None, project_id=1),
    ]

    buffer.process_spans(spans, now=0)

    assert_ttls(buffer.client)

    assert buffer.flush_segments(now=5) == {}
    rv = buffer.flush_segments(now=11)
    assert rv == {_segment_id(1, "a" * 32, "b" * 16): {b"D", b"B", b"A", b"C"}}
    buffer.done_flush_segments(rv)
    assert buffer.flush_segments(now=30) == {}

    assert_clean(buffer.client)


def test_parent_first(buffer: RedisSpansBufferV2):
    spans = [
        Span(payload=b"D", trace_id="a" * 32, span_id="b" * 16, parent_span_id=None, project_id=1),
        Span(
            payload=b"C", trace_id="a" * 32, span_id="e" * 16, parent_span_id="b" * 16, project_id=1
        ),
        Span(
            payload=b"B", trace_id="a" * 32, span_id="d" * 16, parent_span_id="b" * 16, project_id=1
        ),
        Span(
            payload=b"A", trace_id="a" * 32, span_id="c" * 16, parent_span_id="b" * 16, project_id=1
        ),
    ]

    buffer.process_spans(spans, now=0)

    assert_ttls(buffer.client)

    rv = buffer.flush_segments(now=10)
    assert rv == {_segment_id(1, "a" * 32, "b" * 16): {b"D", b"B", b"A", b"C"}}

    buffer.done_flush_segments(rv)

    assert_clean(buffer.client)


def test_parent_middle(buffer: RedisSpansBufferV2):
    spans = [
        Span(
            payload=b"C", trace_id="a" * 32, span_id="e" * 16, parent_span_id="b" * 16, project_id=1
        ),
        Span(
            payload=b"B", trace_id="a" * 32, span_id="d" * 16, parent_span_id="b" * 16, project_id=1
        ),
        Span(payload=b"D", trace_id="a" * 32, span_id="b" * 16, parent_span_id=None, project_id=1),
        Span(
            payload=b"A", trace_id="a" * 32, span_id="c" * 16, parent_span_id="b" * 16, project_id=1
        ),
    ]

    buffer.process_spans(spans, now=0)

    assert_ttls(buffer.client)

    rv = buffer.flush_segments(now=10)
    assert rv == {_segment_id(1, "a" * 32, "b" * 16): {b"D", b"B", b"A", b"C"}}

    buffer.done_flush_segments(rv)

    assert_clean(buffer.client)


def test_parent_middle_deep(buffer: RedisSpansBufferV2):
    spans = [
        Span(
            payload=b"B", trace_id="a" * 32, span_id="b" * 16, parent_span_id="a" * 16, project_id=1
        ),
        Span(
            payload=b"D", trace_id="a" * 32, span_id="d" * 16, parent_span_id="b" * 16, project_id=1
        ),
        Span(payload=b"A", trace_id="a" * 32, span_id="a" * 16, parent_span_id=None, project_id=1),
        Span(
            payload=b"C", trace_id="a" * 32, span_id="c" * 16, parent_span_id="a" * 16, project_id=1
        ),
    ]

    buffer.process_spans(spans, now=0)

    assert_ttls(buffer.client)

    rv = buffer.flush_segments(now=10)
    assert rv == {_segment_id(1, "a" * 32, "a" * 16): {b"D", b"B", b"A", b"C"}}

    buffer.done_flush_segments(rv)

    assert_clean(buffer.client)


def test_parent_in_other_project(buffer: RedisSpansBufferV2):
    spans = [
        Span(
            payload=b"A", trace_id="a" * 32, span_id="c" * 16, parent_span_id="b" * 16, project_id=1
        ),
        Span(
            payload=b"B", trace_id="a" * 32, span_id="d" * 16, parent_span_id="b" * 16, project_id=1
        ),
        Span(
            payload=b"C", trace_id="a" * 32, span_id="e" * 16, parent_span_id="b" * 16, project_id=1
        ),
        Span(payload=b"D", trace_id="a" * 32, span_id="b" * 16, parent_span_id=None, project_id=2),
    ]

    buffer.process_spans(spans, now=0)

    assert_ttls(buffer.client)

    assert buffer.flush_segments(now=5) == {}
    rv = buffer.flush_segments(now=11)
    assert rv == {_segment_id(2, "a" * 32, "b" * 16): {b"D"}}
    buffer.done_flush_segments(rv)

    # TODO: flush faster, since we already saw parent in other project
    assert buffer.flush_segments(now=30) == {}
    rv = buffer.flush_segments(now=60)
    assert rv == {_segment_id(1, "a" * 32, "b" * 16): {b"A", b"B", b"C"}}
    buffer.done_flush_segments(rv)

    assert_clean(buffer.client)


def test_parent_in_other_project_first(buffer: RedisSpansBufferV2):
    spans = [
        Span(payload=b"D", trace_id="a" * 32, span_id="b" * 16, parent_span_id=None, project_id=2),
        Span(
            payload=b"A", trace_id="a" * 32, span_id="c" * 16, parent_span_id="b" * 16, project_id=1
        ),
        Span(
            payload=b"B", trace_id="a" * 32, span_id="d" * 16, parent_span_id="b" * 16, project_id=1
        ),
        Span(
            payload=b"C", trace_id="a" * 32, span_id="e" * 16, parent_span_id="b" * 16, project_id=1
        ),
    ]

    buffer.process_spans(spans, now=0)

    assert_ttls(buffer.client)

    assert buffer.flush_segments(now=5) == {}
    rv = buffer.flush_segments(now=11)
    assert rv == {_segment_id(2, "a" * 32, "b" * 16): {b"D"}}
    buffer.done_flush_segments(rv)

    # TODO: flush faster, since we already saw parent in other project
    assert buffer.flush_segments(now=30) == {}
    rv = buffer.flush_segments(now=60)
    assert rv == {_segment_id(1, "a" * 32, "b" * 16): {b"A", b"B", b"C"}}
    buffer.done_flush_segments(rv)

    assert_clean(buffer.client)
