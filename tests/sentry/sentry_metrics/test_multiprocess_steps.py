from datetime import datetime
from unittest.mock import Mock, call

from arroyo.backends.kafka import KafkaPayload
from arroyo.types import Message, Partition, Topic

from sentry.sentry_metrics.multiprocess import BatchMessages


def test_batch_messages() -> None:
    next_step = Mock()

    max_batch_time = 100.0
    max_batch_size = 2

    batch_messages_step = BatchMessages(
        next_step=next_step, max_batch_time=max_batch_time, max_batch_size=max_batch_size
    )

    message1 = Message(
        Partition(Topic("topic"), 0), 1, KafkaPayload(None, b"some value", []), datetime.now()
    )
    message2 = Message(
        Partition(Topic("topic"), 0), 2, KafkaPayload(None, b"another value", []), datetime.now()
    )

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
    batch_messages_step.submit(message=message2)

    assert len(batch_messages_step._BatchMessages__batch) == 2

    # now the batch_size (2) has been reached, poll should call
    # self.flush which will call the next step's submit and then
    # reset the batch to None
    batch_messages_step.poll()

    assert next_step.submit.call_args == call(
        Message(message2.partition, message2.offset, [message1, message2], message2.timestamp),
    )

    assert batch_messages_step._BatchMessages__batch is None
