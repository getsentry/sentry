from datetime import datetime

import pytest
import rapidjson
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition, Topic

from sentry.spans.consumers.process.factory import ProcessSpansStrategyFactory


@pytest.mark.django_db
def test_basic(monkeypatch):
    # Flush very aggressively to make test pass instantly
    monkeypatch.setattr("time.sleep", lambda _: None)

    topic = Topic("test")
    messages: list[KafkaPayload] = []

    fac = ProcessSpansStrategyFactory(
        max_batch_size=10,
        max_batch_time=10,
        num_processes=1,
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
            BrokerValue(
                partition=Partition(topic, 0),
                offset=1,
                payload=KafkaPayload(
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
                timestamp=datetime.now(),
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
