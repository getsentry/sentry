from unittest.mock import patch

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies import MessageRejected
from arroyo.types import Message, Value

from sentry.replays.consumers.recording import RunTaskThrottled


class MockNextStep:

    def __init__(self):
        self.messages = []

    def submit(self, message: Message[KafkaPayload]):
        self.messages.append(message.value.payload)


def test_message_is_retried():
    def message_rejected(_):
        raise MessageRejected()

    def to_message(value):
        return Message(Value(KafkaPayload(key=None, value=value, headers=[]), {}))

    next_step = MockNextStep()
    run_task = RunTaskThrottled(
        function=lambda n: n.payload.value, next_step=next_step  # type: ignore[arg-type, return-value]
    )

    run_task.submit(to_message(b"1"))
    assert next_step.messages == [b"1"]

    with patch(
        "tests.sentry.replays.unit.consumers.test_run_task_throttled.MockNextStep.submit"
    ) as submit:
        submit.side_effect = message_rejected

        try:
            run_task.submit(to_message(b"2"))
        except MessageRejected:
            ...

        assert next_step.messages == [b"1"]

    run_task.submit(to_message(b"2"))
    assert next_step.messages == [b"1", b"2"]


def test_message_is_carried():
    def message_rejected(_):
        raise MessageRejected()

    def to_message(value):
        return Message(Value(KafkaPayload(key=None, value=value, headers=[]), {}))

    next_step = MockNextStep()
    run_task = RunTaskThrottled(
        function=lambda n: n.payload.value, next_step=next_step  # type: ignore[arg-type, return-value]
    )

    run_task.submit(to_message(b"1"))
    assert next_step.messages == [b"1"]

    with patch(
        "tests.sentry.replays.unit.consumers.test_run_task_throttled.MockNextStep.submit"
    ) as submit:
        submit.side_effect = message_rejected

        try:
            run_task.submit(to_message(b"2"))
        except MessageRejected:
            ...

        assert next_step.messages == [b"1"]

    run_task.submit(to_message(b"3"))
    assert next_step.messages == [b"1", b"2", b"3"]
