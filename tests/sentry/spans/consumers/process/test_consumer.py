from datetime import datetime
from time import sleep

import rapidjson
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import Message, Partition, Topic, Value

from sentry.spans.consumers.process.factory import ProcessSpansStrategyFactory


def test_basic(monkeypatch):
    # Flush very aggressively to make test pass instantly
    monkeypatch.setattr("time.sleep", lambda _: None)

    topic = Topic("test")
    messages: list[KafkaPayload] = []

    fac = ProcessSpansStrategyFactory(
        max_batch_size=10,
        max_batch_time=10,
        num_processes=1,
        max_flush_segments=10,
        input_block_size=None,
        output_block_size=None,
        produce_to_pipe=messages.append,
    )

    commits = []

    def add_commit(offsets, force=False):
        commits.append(offsets)

    step = fac.create_with_partitions(add_commit, {Partition(topic, 0): 0})

    step.submit(
        Message(
            Value(
                KafkaPayload(
                    None,
                    rapidjson.dumps(
                        {
                            "project_id": 12,
                            "span_id": "a" * 16,
                            "trace_id": "b" * 32,
                        }
                    ).encode("ascii"),
                    [],
                ),
                {},
                datetime.now(),
            )
        )
    )

    step.poll()
    fac._flusher.current_drift.value = 9000  # "advance" our "clock"

    step.join()

    (msg,) = messages

    assert rapidjson.loads(msg.value) == {
        "spans": [
            {
                "data": {
                    "__sentry_internal_span_buffer_outcome": "different",
                },
                "is_segment": True,
                "project_id": 12,
                "segment_id": "aaaaaaaaaaaaaaaa",
                "span_id": "aaaaaaaaaaaaaaaa",
                "trace_id": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            },
        ],
    }


def test_backpressure(monkeypatch):
    # Flush very aggressively to make test pass instantly
    monkeypatch.setattr("time.sleep", lambda _: None)

    topic = Topic("test")
    messages: list[KafkaPayload] = []

    fac = ProcessSpansStrategyFactory(
        max_batch_size=10,
        max_batch_time=10,
        num_processes=1,
        max_flush_segments=10,
        input_block_size=None,
        output_block_size=None,
        produce_to_pipe=messages.append,
        max_inflight_segments=10,
    )

    commits = []

    def add_commit(offsets, force=False):
        commits.append(offsets)

    step = fac.create_with_partitions(add_commit, {Partition(topic, 0): 0})

    for i in range(200):
        step.poll()
        step.submit(
            Message(
                Value(
                    KafkaPayload(
                        None,
                        rapidjson.dumps(
                            {
                                "project_id": 12,
                                # distinct segments
                                "span_id": f"{i:0>16x}",
                                "parent_span_id": None,
                                "trace_id": "b" * 32,
                            }
                        ).encode("ascii"),
                        [],
                    ),
                    {},
                    datetime.now(),
                )
            )
        )

    step.poll()
    fac._flusher.current_drift.value = 20000  # "advance" our "clock"

    sleep(0.1)
    step.join()

    assert len(messages) == 99

    assert rapidjson.loads(msg.value) == {
        "spans": [
            {
                "data": {
                    "__sentry_internal_span_buffer_outcome": "different",
                },
                "is_segment": True,
                "project_id": 12,
                "segment_id": "aaaaaaaaaaaaaaaa",
                "span_id": "aaaaaaaaaaaaaaaa",
                "trace_id": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            },
        ],
    }
