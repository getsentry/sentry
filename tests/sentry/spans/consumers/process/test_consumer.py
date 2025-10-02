from datetime import datetime
from time import sleep as real_sleep  # Import before monkeypatch
from unittest import mock

import orjson
import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition, Topic

from sentry.spans.consumers.process.factory import ProcessSpansStrategyFactory
from sentry.testutils.helpers.options import override_options
from tests.sentry.spans.test_buffer import DEFAULT_OPTIONS


@override_options({**DEFAULT_OPTIONS, "spans.drop-in-buffer": []})
@pytest.mark.parametrize("kafka_slice_id", [None, 2])
def test_basic(kafka_slice_id: int | None) -> None:
    # Flush very aggressively to make test pass instantly
    with mock.patch("time.sleep"):
        topic = Topic("test")
        messages: list[KafkaPayload] = []

        fac = ProcessSpansStrategyFactory(
            max_batch_size=1,
            max_batch_time=10,
            num_processes=1,
            input_block_size=None,
            output_block_size=None,
            produce_to_pipe=messages.append,
            kafka_slice_id=kafka_slice_id,
        )

        commits = []

        def add_commit(offsets, force=False):
            commits.append(offsets)

        step = fac.create_with_partitions(add_commit, {Partition(topic, 0): 0})

        try:
            step.submit(
                Message(
                    BrokerValue(
                        partition=Partition(topic, 0),
                        offset=1,
                        payload=KafkaPayload(
                            None,
                            orjson.dumps(
                                {
                                    "project_id": 12,
                                    "span_id": "a" * 16,
                                    "trace_id": "b" * 32,
                                    "end_timestamp": 1700000000.0,
                                }
                            ),
                            [],
                        ),
                        timestamp=datetime.now(),
                    )
                )
            )

            step.poll()
            fac._flusher.current_drift.value = 9000  # "advance" our "clock"

            step.poll()
            # Give flusher threads time to process after drift change
            for _ in range(20):
                if messages:
                    break
                step.poll()
                real_sleep(0.1)

            (msg,) = messages

            assert orjson.loads(msg.value) == {
                "spans": [
                    {
                        "attributes": {
                            "sentry.is_segment": {"type": "boolean", "value": True},
                            "sentry.segment.id": {"type": "string", "value": "aaaaaaaaaaaaaaaa"},
                        },
                        "project_id": 12,
                        "span_id": "aaaaaaaaaaaaaaaa",
                        "trace_id": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                        "end_timestamp": 1700000000.0,
                    },
                ],
            }
        finally:
            fac._flusher.join()


@override_options({**DEFAULT_OPTIONS, "spans.drop-in-buffer": []})
def test_flusher_processes_limit() -> None:
    """Test that flusher respects the max_processes limit"""
    # Flush very aggressively to make test pass instantly
    with mock.patch("time.sleep"):

        topic = Topic("test")
        messages: list[KafkaPayload] = []

        # Create factory with limited flusher processes
        fac = ProcessSpansStrategyFactory(
            max_batch_size=10,
            max_batch_time=10,
            num_processes=1,
            input_block_size=None,
            output_block_size=None,
            flusher_processes=2,  # Limit to 2 processes even if more shards
            produce_to_pipe=messages.append,
        )

        commits = []

        def add_commit(offsets, force=False):
            commits.append(offsets)

        # Create with 4 partitions/shards to test process sharing
        partitions = {Partition(topic, i): 0 for i in range(4)}
        fac.create_with_partitions(add_commit, partitions)
        flusher = fac._flusher

        try:
            # Verify that flusher uses at most 2 processes
            assert len(flusher.processes) == 2
            assert flusher.max_processes == 2
            assert flusher.num_processes == 2

            # Verify shards are distributed across processes
            total_shards = sum(len(shards) for shards in flusher.process_to_shards_map.values())
            assert total_shards == 4  # All 4 shards should be assigned
        finally:
            # shutdown flusher thread
            fac._flusher.join()
