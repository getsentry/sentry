from __future__ import annotations

import pytest
from sentry_redis_tools.clients import StrictRedis

from sentry.spans.buffer_v2 import RedisSpansBufferV2, Span


@pytest.fixture
def buffer():
    return RedisSpansBufferV2()


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
    assert not client.keys("*")


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
    assert rv == {buffer._segment_id(1, "a" * 32, "b" * 16): {b"D", b"B", b"A", b"C"}}
    assert buffer.flush_segments(now=30) == {}

    buffer.done_flush_segments(rv)

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

    assert buffer.flush_segments(now=10) == {}
    assert buffer.flush_segments(now=20) == {}
    rv = buffer.flush_segments(now=60)
    assert rv == {buffer._segment_id(1, "a" * 32, "b" * 16): {b"D", b"B", b"A", b"C"}}

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

    assert buffer.flush_segments(now=10) == {}
    assert buffer.flush_segments(now=20) == {}
    rv = buffer.flush_segments(now=60)
    assert rv == {buffer._segment_id(1, "a" * 32, "b" * 16): {b"D", b"B", b"A", b"C"}}

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
    assert rv == {buffer._segment_id(2, "a" * 32, "b" * 16): {b"D"}}
    buffer.done_flush_segments(rv)

    # TODO: flush faster, since we already saw parent in other project
    assert buffer.flush_segments(now=30) == {}
    rv = buffer.flush_segments(now=60)
    assert rv == {buffer._segment_id(1, "a" * 32, "b" * 16): {b"A", b"B", b"C"}}
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
    assert rv == {buffer._segment_id(2, "a" * 32, "b" * 16): {b"D"}}
    buffer.done_flush_segments(rv)

    # TODO: flush faster, since we already saw parent in other project
    assert buffer.flush_segments(now=30) == {}
    rv = buffer.flush_segments(now=60)
    assert rv == {buffer._segment_id(1, "a" * 32, "b" * 16): {b"A", b"B", b"C"}}
    buffer.done_flush_segments(rv)

    assert_clean(buffer.client)


# TODO: transitive parents
