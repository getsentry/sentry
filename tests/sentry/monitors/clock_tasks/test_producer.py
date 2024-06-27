from unittest import mock

from arroyo import Topic
from arroyo.backends.kafka import KafkaPayload
from django.test import override_settings
from sentry_kafka_schemas.schema_types.monitors_clock_tasks_v1 import MarkTimeout

from sentry.monitors.clock_tasks.producer import MONITORS_CLOCK_TASKS_CODEC, produce_task


@override_settings(KAFKA_TOPIC_OVERRIDES={"monitors-clock-tasks": "monitors-test-topic"})
@mock.patch("sentry.monitors.clock_tasks.producer._clock_task_producer")
def test_produce_task(mock_producer):

    message: MarkTimeout = {
        "type": "mark_timeout",
        "ts": 123,
        "monitor_environment_id": 1,
        "checkin_id": 1,
    }
    test_payload = KafkaPayload(
        b"some-key",
        MONITORS_CLOCK_TASKS_CODEC.encode(message),
        [],
    )

    produce_task(test_payload)

    # One clock pulse per partition
    assert mock_producer.produce.call_count == 1
    assert mock_producer.produce.mock_calls[0] == mock.call(
        Topic("monitors-test-topic"), test_payload
    )
