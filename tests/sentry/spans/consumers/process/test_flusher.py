import time
from time import sleep
from typing import Any

import orjson
from arroyo.processing.strategies.noop import Noop
from django.test import override_settings

from sentry.conf.types.kafka_definition import Topic
from sentry.spans.buffer import Span, SpansBuffer
from sentry.spans.consumers.process.flusher import MultiProducer, SpanFlusher
from sentry.testutils import thread_leaks
from sentry.testutils.helpers.options import override_options
from tests.sentry.spans.test_buffer import DEFAULT_OPTIONS


def _payload(span_id: str) -> bytes:
    return orjson.dumps({"span_id": span_id})


@override_options({**DEFAULT_OPTIONS, "spans.buffer.max-flush-segments": 1})
@thread_leaks.allowlist(issue=-1)
def test_backpressure(monkeypatch):
    # Flush very aggressively to make join() faster
    monkeypatch.setattr("time.sleep", lambda _: None)

    messages = []

    def append(msg):
        messages.append(msg)
        sleep(1.0)

    buffer = SpansBuffer(assigned_shards=list(range(1)))
    flusher = SpanFlusher(
        buffer,
        next_step=Noop(),
        produce_to_pipe=append,
    )

    now = time.time()

    for i in range(200):
        trace_id = f"{i:0>32x}"

        spans = [
            Span(
                payload=_payload("a" * 16),
                trace_id=trace_id,
                span_id="a" * 16,
                parent_span_id="b" * 16,
                project_id=1,
                end_timestamp_precise=now,
            ),
            Span(
                payload=_payload("d" * 16),
                trace_id=trace_id,
                span_id="d" * 16,
                parent_span_id="b" * 16,
                project_id=1,
                end_timestamp_precise=now,
            ),
            Span(
                payload=_payload("c" * 16),
                trace_id=trace_id,
                span_id="c" * 16,
                parent_span_id="b" * 16,
                project_id=1,
                end_timestamp_precise=now,
            ),
            Span(
                payload=_payload("b" * 16),
                trace_id=trace_id,
                span_id="b" * 16,
                parent_span_id=None,
                is_segment_span=True,
                project_id=1,
                end_timestamp_precise=now,
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


def create_memory_producer_factory():
    """Create a factory that returns in-memory LocalProducers from Arroyo."""
    from arroyo.backends.local.backend import LocalBroker
    from arroyo.backends.local.storages.memory import MemoryMessageStorage

    # Create shared storage so we can inspect messages across producers
    storage = MemoryMessageStorage[Any]()
    broker = LocalBroker(storage)

    def producer_factory(producer_config):
        return broker.get_producer()

    # Return both factory and storage for inspection
    return broker, producer_factory, storage


@override_settings(
    SLICED_KAFKA_TOPICS={
        ("buffered-segments", 0): {"cluster": "default", "topic": "buffered-segments-1"},
        ("buffered-segments", 1): {"cluster": "default", "topic": "buffered-segments-2"},
    }
)
def test_multi_producer_sliced_integration_with_arroyo_local_producer():
    from arroyo import Topic as ArroyoTopic
    from arroyo.backends.kafka import KafkaPayload

    broker, producer_factory, storage = create_memory_producer_factory()
    broker.create_topic(ArroyoTopic("buffered-segments-1"), partitions=1)
    broker.create_topic(ArroyoTopic("buffered-segments-2"), partitions=1)

    manager = MultiProducer(Topic.BUFFERED_SEGMENTS, producer_factory=producer_factory)

    assert len(manager.producers) == 2
    assert len(manager.topics) == 2

    topic_names = [topic.name for topic in manager.topics]
    assert "buffered-segments-1" in topic_names
    assert "buffered-segments-2" in topic_names

    payload1 = KafkaPayload(None, b"test-message-1", [])
    payload2 = KafkaPayload(None, b"test-message-2", [])
    payload3 = KafkaPayload(None, b"test-message-3", [])

    manager.produce(payload1)
    manager.produce(payload2)
    manager.produce(payload3)

    from arroyo import Partition

    topic1_partition = Partition(ArroyoTopic("buffered-segments-1"), 0)
    topic2_partition = Partition(ArroyoTopic("buffered-segments-2"), 0)

    message1 = broker.consume(topic1_partition, 0)
    message2 = broker.consume(topic2_partition, 0)
    message3 = broker.consume(topic1_partition, 1)

    assert message1 is not None
    assert message2 is not None
    assert message3 is not None

    assert message1.payload.value == b"test-message-1"
    assert message2.payload.value == b"test-message-2"
    assert message3.payload.value == b"test-message-3"

    manager.close()
