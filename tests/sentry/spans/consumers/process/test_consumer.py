from concurrent import futures
from datetime import datetime

import rapidjson
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import Message, Partition, Topic, Value

from sentry.spans.consumers.process.factory import ProcessSpansStrategyFactory


def test_basic(monkeypatch, request):
    monkeypatch.setattr(futures, "wait", lambda _: None)
    monkeypatch.setattr("time.sleep", lambda _: None)

    topic = Topic("test")
    fac = ProcessSpansStrategyFactory(
        max_batch_size=10,
        max_batch_time=10,
        num_processes=1,
        max_flush_segments=10,
        input_block_size=None,
        output_block_size=None,
    )

    produced_messages = []

    def produce(produce_topic, message):
        produced_messages.append(message)
        # The real produce would return a future here, but it doesn't matter
        # because we also patched futures.wait
        return None

    fac.producer.produce = produce  # type:ignore[method-assign]

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

    @request.addfinalizer
    def _():
        step.join()
        fac.shutdown()

    step.poll()
    fac._flusher.current_drift = 9000  # "advance" our "clock"

    step.join()

    (msg,) = produced_messages
    assert rapidjson.loads(msg.value) == {
        "spans": [
            {
                "is_segment": True,
                "project_id": 12,
                "segment_id": "aaaaaaaaaaaaaaaa",
                "span_id": "aaaaaaaaaaaaaaaa",
                "trace_id": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            },
        ],
    }
