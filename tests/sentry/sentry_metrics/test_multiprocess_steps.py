import time
from datetime import datetime, timezone
from typing import Dict, List, Mapping, MutableMapping, Union
from unittest.mock import Mock, call, patch

import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.backends.local.backend import LocalBroker as Broker
from arroyo.backends.local.storages.memory import MemoryMessageStorage
from arroyo.processing.strategies import MessageRejected
from arroyo.types import Message, Partition, Position, Topic
from arroyo.utils.clock import TestingClock as Clock

from sentry.sentry_metrics.indexer.mock import MockIndexer
from sentry.sentry_metrics.multiprocess import (
    BatchMessages,
    DuplicateMessage,
    MetricsBatchBuilder,
    ProduceStep,
    process_messages,
)
from sentry.sentry_metrics.sessions import SessionMetricKey
from sentry.utils import json


def _batch_message_set_up(next_step: Mock, max_batch_time: float = 100.0, max_batch_size: int = 2):
    # batch time is in seconds
    batch_messages_step = BatchMessages(
        next_step=next_step, max_batch_time=max_batch_time, max_batch_size=max_batch_size
    )

    message1 = Message(
        Partition(Topic("topic"), 0), 1, KafkaPayload(None, b"some value", []), datetime.now()
    )
    message2 = Message(
        Partition(Topic("topic"), 0), 2, KafkaPayload(None, b"another value", []), datetime.now()
    )
    return (batch_messages_step, message1, message2)


def test_batch_messages() -> None:
    next_step = Mock()

    batch_messages_step, message1, message2 = _batch_message_set_up(next_step)

    # submit the first message, batch builder should should be created
    # and the messaged added to the batch
    batch_messages_step.submit(message=message1)

    assert len(batch_messages_step._BatchMessages__batch) == 1

    # neither batch_size or batch_time as been met so poll shouldn't
    # do anything yet (aka shouldn't flush and call next_step.submit)
    batch_messages_step.poll()

    assert len(batch_messages_step._BatchMessages__batch) == 1
    assert not next_step.submit.called

    # submit the second message, message should be added to the batch
    # which will now saturate the batch_size (2). This will trigger
    # __flush which in turn calls next.submit and reset the batch to None
    batch_messages_step.submit(message=message2)

    assert next_step.submit.call_args == call(
        Message(message2.partition, message2.offset, [message1, message2], message2.timestamp),
    )

    assert batch_messages_step._BatchMessages__batch is None


def test_batch_messages_rejected_message():
    next_step = Mock()
    next_step.submit.side_effect = MessageRejected()

    batch_messages_step, message1, message2 = _batch_message_set_up(next_step)

    batch_messages_step.poll()
    batch_messages_step.submit(message=message1)

    # if we try to submit a batch when the next step is
    # not ready to accept more messages we'll get a
    # MessageRejected error which will bubble up to the
    # StreamProcessor.
    with pytest.raises(MessageRejected):
        batch_messages_step.submit(message=message2)

    # when poll is called, we still try to flush the batch
    # caust its full but we handled the MessageRejected error
    batch_messages_step.poll()
    assert next_step.submit.called


def test_batch_messages_join():
    next_step = Mock()

    batch_messages_step, message1, _ = _batch_message_set_up(next_step)

    batch_messages_step.poll()
    batch_messages_step.submit(message=message1)
    # A rebalance, restart, scale up or any other event
    # that causes partitions to be revoked will call join
    batch_messages_step.join(timeout=3)
    # we don't flush the batch
    assert not next_step.submit.called


def test_metrics_batch_builder():
    max_batch_time = 3.0  # seconds
    max_batch_size = 2

    # 1. Ready when max_batch_size is reached
    batch_builder_size = MetricsBatchBuilder(
        max_batch_size=max_batch_size, max_batch_time=max_batch_time
    )

    assert not batch_builder_size.ready()

    message1 = Message(
        Partition(Topic("topic"), 0), 1, KafkaPayload(None, b"some value", []), datetime.now()
    )
    batch_builder_size.append(message1)
    assert not batch_builder_size.ready()

    message2 = Message(
        Partition(Topic("topic"), 0), 2, KafkaPayload(None, b"another value", []), datetime.now()
    )
    batch_builder_size.append(message2)
    assert batch_builder_size.ready()

    # 2. Ready when max_batch_time is reached
    batch_builder_time = MetricsBatchBuilder(
        max_batch_size=max_batch_size, max_batch_time=max_batch_time
    )

    assert not batch_builder_time.ready()

    message1 = Message(
        Partition(Topic("topic"), 0), 1, KafkaPayload(None, b"some value", []), datetime.now()
    )
    batch_builder_time.append(message1)
    assert not batch_builder_time.ready()

    time.sleep(3)
    assert batch_builder_time.ready()

    # 3. Adding the same message twice to the same batch
    batch_builder_time = MetricsBatchBuilder(
        max_batch_size=max_batch_size, max_batch_time=max_batch_time
    )
    message1 = Message(
        Partition(Topic("topic"), 0), 1, KafkaPayload(None, b"some value", []), datetime.now()
    )
    batch_builder_time.append(message1)
    with pytest.raises(DuplicateMessage):
        batch_builder_time.append(message1)


ts = int(datetime.now(tz=timezone.utc).timestamp())
counter_payload = {
    "name": SessionMetricKey.SESSION.value,
    "tags": {
        "environment": "production",
        "session.status": "init",
    },
    "timestamp": ts,
    "type": "c",
    "value": 1.0,
    "org_id": 1,
    "project_id": 3,
}
distribution_payload = {
    "name": SessionMetricKey.SESSION_DURATION.value,
    "tags": {
        "environment": "production",
        "session.status": "healthy",
    },
    "timestamp": ts,
    "type": "d",
    "value": [4, 5, 6],
    "unit": "seconds",
    "org_id": 1,
    "project_id": 3,
}

set_payload = {
    "name": SessionMetricKey.SESSION_ERROR.value,
    "tags": {
        "environment": "production",
        "session.status": "errored",
    },
    "timestamp": ts,
    "type": "s",
    "value": [3],
    "org_id": 1,
    "project_id": 3,
}


def __translated_payload(
    payload,
) -> Dict[str, Union[str, int, List[int], MutableMapping[int, int]]]:
    """
    Translates strings to ints using the MockIndexer
    in addition to adding the retention_days

    """
    indexer = MockIndexer()
    payload = payload.copy()
    org_id = payload["org_id"]

    new_tags = {
        indexer.resolve(org_id, k): indexer.resolve(org_id, v) for k, v in payload["tags"].items()
    }
    payload["metric_id"] = indexer.resolve(org_id, payload["name"])
    payload["retention_days"] = 90
    payload["tags"] = new_tags

    del payload["name"]
    return payload


@patch("sentry.sentry_metrics.indexer.tasks.process_indexed_metrics")
@patch("sentry.sentry_metrics.multiprocess.get_indexer", return_value=MockIndexer())
def test_process_messages(mock_indexer, mock_task) -> None:
    message_payloads = [counter_payload, distribution_payload, set_payload]
    message_batch = [
        Message(
            Partition(Topic("topic"), 0),
            i + 1,
            KafkaPayload(None, json.dumps(payload).encode("utf-8"), []),
            datetime.now(),
        )
        for i, payload in enumerate(message_payloads)
    ]
    # the outer message uses the last message's partition, offset, and timestamp
    last = message_batch[-1]
    outer_message = Message(last.partition, last.offset, message_batch, last.timestamp)

    new_batch = process_messages(outer_message=outer_message)
    expected_new_batch = [
        Message(
            m.partition,
            m.offset,
            KafkaPayload(
                None,
                json.dumps(__translated_payload(message_payloads[i])).encode("utf-8"),
                [],
            ),
            m.timestamp,
        )
        for i, m in enumerate(message_batch)
    ]

    assert new_batch == expected_new_batch


def test_produce_step() -> None:
    topic = Topic("snuba-metrics")
    partition = Partition(topic, 0)

    clock = Clock()
    broker_storage: MemoryMessageStorage[KafkaPayload] = MemoryMessageStorage()
    broker: Broker[KafkaPayload] = Broker(broker_storage, clock)
    broker.create_topic(topic, partitions=1)
    producer = broker.get_producer()

    commit = Mock()

    produce_step = ProduceStep(commit_function=commit, producer=producer)

    message_payloads = [counter_payload, distribution_payload, set_payload]
    message_batch = [
        Message(
            Partition(Topic("topic"), 0),
            i + 1,
            KafkaPayload(
                None, json.dumps(__translated_payload(message_payloads[i])).encode("utf-8"), []
            ),
            datetime.now(),
        )
        for i, payload in enumerate(message_payloads)
    ]
    # the outer message uses the last message's partition, offset, and timestamp
    last = message_batch[-1]
    outer_message = Message(last.partition, last.offset, message_batch, last.timestamp)

    # 1. Submit the message (that would have been generated from process_messages)
    produce_step.submit(outer_message=outer_message)

    # 2. Check that submit created the same number of futures as
    #    messages in the outer_message (3 in this test). Also check
    #    that the produced message payloads are as expected.
    assert len(produce_step._ProduceStep__futures) == 3

    first_message = broker_storage.consume(partition, 0)
    assert first_message is not None

    second_message = broker_storage.consume(partition, 1)
    assert second_message is not None

    third_message = broker_storage.consume(partition, 2)
    assert third_message is not None

    assert broker_storage.consume(partition, 3) is None

    produced_messages = [
        json.loads(msg.payload.value.decode("utf-8"), use_rapid_json=True)
        for msg in [first_message, second_message, third_message]
    ]
    expected_produced_messages = []
    for payload in message_payloads:
        translated = __translated_payload(payload)
        tags: Mapping[str, int] = {str(k): v for k, v in translated["tags"].items()}
        translated.update(**{"tags": tags})
        expected_produced_messages.append(translated)

    assert produced_messages == expected_produced_messages

    # 3. Call poll method, and check that doing so checked that
    #    futures were ready and successful and therefore messages
    #    were committed.
    produce_step.poll()
    expected_commit_calls = [
        call({message.partition: Position(message.offset, message.timestamp)})
        for message in message_batch
    ]
    assert commit.call_args_list == expected_commit_calls

    produce_step.close()
    produce_step.join()
