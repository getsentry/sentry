import threading
from datetime import datetime

import rapidjson
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import Message, Partition, Topic, Value

from sentry.spans.consumers.process.factory import ProcessSpansStrategyFactory


class FakeProcess(threading.Thread):
    """
    Pretend this is multiprocessing.Process
    """

    def terminate(self):
        pass


def test_basic(monkeypatch, request):
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

    @request.addfinalizer
    def _():
        step.join()
        fac.shutdown()

    step.poll()
    fac._flusher.current_drift.value = 9000  # "advance" our "clock"

    step.join()

    (msg,) = messages

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
