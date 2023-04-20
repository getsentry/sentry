import logging
import pickle
import time
from copy import deepcopy
from datetime import datetime, timezone
from typing import Dict, List, MutableMapping, Sequence, Union
from unittest.mock import Mock, call

import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.processing.strategies import MessageRejected
from arroyo.types import BrokerValue, Message, Partition, Topic, Value

from sentry.ratelimits.cardinality import CardinalityLimiter
from sentry.sentry_metrics.configuration import IndexerStorage, UseCaseKey, get_ingest_config
from sentry.sentry_metrics.consumers.indexer.batch import invalid_metric_tags, valid_metric_name
from sentry.sentry_metrics.consumers.indexer.common import BatchMessages, MetricsBatchBuilder
from sentry.sentry_metrics.consumers.indexer.processing import MessageProcessor
from sentry.sentry_metrics.indexer.limiters.cardinality import (
    TimeseriesCardinalityLimiter,
    cardinality_limiter_factory,
)
from sentry.sentry_metrics.indexer.mock import MockIndexer
from sentry.snuba.metrics.naming_layer.mri import SessionMRI
from sentry.utils import json

logger = logging.getLogger(__name__)


pytestmark = pytest.mark.sentry_metrics

MESSAGE_PROCESSOR = MessageProcessor(
    get_ingest_config(UseCaseKey.RELEASE_HEALTH, IndexerStorage.POSTGRES)
)


def compare_messages_ignoring_mapping_metadata(actual: Message, expected: Message) -> None:
    assert actual.committable == expected.committable

    actual_payload: KafkaPayload = actual.payload
    expected_payload: KafkaPayload = expected.payload

    assert actual_payload.key == expected_payload.key

    actual_headers_without_mapping_sources = [
        (k, v) for k, v in actual_payload.headers if k != "mapping_sources"
    ]
    assert actual_headers_without_mapping_sources == expected_payload.headers

    actual_deserialized = json.loads(actual_payload.value)
    expected_deserialized = json.loads(expected_payload.value)
    del actual_deserialized["mapping_meta"]
    assert actual_deserialized == expected_deserialized


def compare_message_batches_ignoring_metadata(
    actual: Sequence[Message], expected: Sequence[Message]
) -> None:
    assert len(actual) == len(expected)
    for (a, e) in zip(actual, expected):
        compare_messages_ignoring_mapping_metadata(a, e)


def _batch_message_set_up(next_step: Mock, max_batch_time: float = 100.0, max_batch_size: int = 2):
    # batch time is in seconds
    batch_messages_step = BatchMessages(
        next_step=next_step, max_batch_time=max_batch_time, max_batch_size=max_batch_size
    )

    message1 = Message(
        BrokerValue(
            KafkaPayload(None, b"some value", []), Partition(Topic("topic"), 0), 1, datetime.now()
        )
    )
    message2 = Message(
        BrokerValue(
            KafkaPayload(None, b"another value", []),
            Partition(Topic("topic"), 0),
            2,
            datetime.now(),
        )
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
        Message(Value([message1, message2], message2.committable)),
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
    # MessageRejected error. This will be reraised for
    # to the stream processor on the subsequent call to submit
    batch_messages_step.submit(message=message2)

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
        BrokerValue(
            KafkaPayload(None, b"some value", []), Partition(Topic("topic"), 0), 1, datetime.now()
        )
    )
    batch_builder_size.append(message1)
    assert not batch_builder_size.ready()

    message2 = Message(
        BrokerValue(
            KafkaPayload(None, b"another value", []),
            Partition(Topic("topic"), 0),
            2,
            datetime.now(),
        )
    )
    batch_builder_size.append(message2)
    assert batch_builder_size.ready()

    # 2. Ready when max_batch_time is reached
    batch_builder_time = MetricsBatchBuilder(
        max_batch_size=max_batch_size, max_batch_time=max_batch_time
    )

    assert not batch_builder_time.ready()

    message1 = Message(
        BrokerValue(
            KafkaPayload(None, b"some value", []), Partition(Topic("topic"), 0), 1, datetime.now()
        )
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
        BrokerValue(
            KafkaPayload(None, b"some value", []), Partition(Topic("topic"), 0), 1, datetime.now()
        )
    )
    batch_builder_time.append(message1)


ts = int(datetime.now(tz=timezone.utc).timestamp())
counter_payload = {
    "name": SessionMRI.SESSION.value,
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
    "name": SessionMRI.RAW_DURATION.value,
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
    "name": SessionMRI.ERROR.value,
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
    payload = deepcopy(payload)
    org_id = payload["org_id"]

    new_tags = {
        indexer.resolve(
            use_case_id=UseCaseKey.RELEASE_HEALTH, org_id=org_id, string=k
        ): indexer.resolve(use_case_id=UseCaseKey.RELEASE_HEALTH, org_id=org_id, string=v)
        for k, v in payload["tags"].items()
    }
    payload["metric_id"] = indexer.resolve(
        use_case_id=UseCaseKey.RELEASE_HEALTH, org_id=org_id, string=payload["name"]
    )
    payload["retention_days"] = 90
    payload["tags"] = new_tags
    payload["use_case_id"] = "release-health"

    payload.pop("unit", None)
    del payload["name"]
    return payload


def test_process_messages(set_sentry_option) -> None:
    set_sentry_option("sentry-metrics.consumer-schema-validation.release-health.rollout-rate", 0.0)
    message_payloads = [counter_payload, distribution_payload, set_payload]
    message_batch = [
        Message(
            BrokerValue(
                KafkaPayload(None, json.dumps(payload).encode("utf-8"), []),
                Partition(Topic("topic"), 0),
                i + 1,
                datetime.now(),
            )
        )
        for i, payload in enumerate(message_payloads)
    ]
    # the outer message uses the last message's partition, offset, and timestamp
    last = message_batch[-1]

    outer_message = Message(Value(message_batch, last.committable))

    new_batch = MESSAGE_PROCESSOR.process_messages(outer_message=outer_message)
    expected_new_batch = [
        Message(
            BrokerValue(
                KafkaPayload(
                    None,
                    json.dumps(__translated_payload(message_payloads[i])).encode("utf-8"),
                    [("metric_type", message_payloads[i]["type"])],
                ),
                m.value.partition,
                m.value.offset,
                m.value.timestamp,
            )
        )
        for i, m in enumerate(message_batch)
    ]
    compare_message_batches_ignoring_metadata(new_batch, expected_new_batch)


invalid_payloads = [
    (
        {
            "name": SessionMRI.ERROR.value,
            "tags": {
                "environment": "production" * 21,
                "session.status": "errored",
            },
            "timestamp": ts,
            "type": "s",
            "value": [3],
            "org_id": 1,
            "project_id": 3,
        },
        "invalid_tags",
        True,
    ),
    (
        {
            "name": SessionMRI.ERROR.value * 21,
            "tags": {
                "environment": "production",
                "session.status": "errored",
            },
            "timestamp": ts,
            "type": "s",
            "value": [3],
            "org_id": 1,
            "project_id": 3,
        },
        "invalid_metric_name",
        True,
    ),
    (
        b"invalid_json_payload",
        "invalid_json",
        False,
    ),
]


@pytest.mark.parametrize("invalid_payload, error_text, format_payload", invalid_payloads)
def test_process_messages_invalid_messages(
    invalid_payload, error_text, format_payload, caplog
) -> None:
    """
    Test the following kinds of invalid payloads:
        * tag key > 200 char
        * metric name > 200 char
        * invalid json

    Each outer_message that is passed into process_messages is a batch of messages. If
    there is an invalid payload for one of the messages, we just drop that message,
    not the entire batch.

    The `counter_payload` in these tests is always a valid payload, and the test arg
    `invalid_payload` has a payload that fits the scenarios outlined above.

    """
    formatted_payload = (
        json.dumps(invalid_payload).encode("utf-8") if format_payload else invalid_payload
    )
    message_batch = [
        Message(
            BrokerValue(
                KafkaPayload(None, json.dumps(counter_payload).encode("utf-8"), []),
                Partition(Topic("topic"), 0),
                0,
                datetime.now(),
            )
        ),
        Message(
            BrokerValue(
                KafkaPayload(None, formatted_payload, []),
                Partition(Topic("topic"), 0),
                1,
                datetime.now(),
            )
        ),
    ]
    # the outer message uses the last message's partition, offset, and timestamp
    last = message_batch[-1]

    outer_message = Message(Value(message_batch, last.committable))

    with caplog.at_level(logging.ERROR):
        new_batch = MESSAGE_PROCESSOR.process_messages(outer_message=outer_message)

    # we expect just the valid counter_payload msg to be left
    expected_msg = message_batch[0]
    expected_new_batch = [
        Message(
            Value(
                KafkaPayload(
                    None,
                    json.dumps(__translated_payload(counter_payload)).encode("utf-8"),
                    [("metric_type", "c")],
                ),
                expected_msg.committable,
            )
        )
    ]
    compare_message_batches_ignoring_metadata(new_batch, expected_new_batch)
    assert error_text in caplog.text


def test_process_messages_rate_limited(caplog, settings) -> None:
    """
    Test handling of `None`-values coming from the indexer service, which
    happens when postgres writes are being rate-limited.
    """
    settings.SENTRY_METRICS_INDEXER_DEBUG_LOG_SAMPLE_RATE = 1.0
    rate_limited_payload = deepcopy(distribution_payload)
    rate_limited_payload["tags"]["custom_tag"] = "rate_limited_test"

    rate_limited_payload2 = deepcopy(distribution_payload)
    rate_limited_payload2["name"] = "rate_limited_test"

    message_batch = [
        Message(
            BrokerValue(
                KafkaPayload(None, json.dumps(counter_payload).encode("utf-8"), []),
                Partition(Topic("topic"), 0),
                0,
                datetime.now(),
            )
        ),
        Message(
            BrokerValue(
                KafkaPayload(None, json.dumps(rate_limited_payload).encode("utf-8"), []),
                Partition(Topic("topic"), 0),
                1,
                datetime.now(),
            )
        ),
        Message(
            BrokerValue(
                KafkaPayload(None, json.dumps(rate_limited_payload2).encode("utf-8"), []),
                Partition(Topic("topic"), 0),
                2,
                datetime.now(),
            )
        ),
    ]
    # the outer message uses the last message's partition, offset, and timestamp
    last = message_batch[-1]
    outer_message = Message(Value(message_batch, last.committable))

    message_processor = MessageProcessor(
        get_ingest_config(UseCaseKey.RELEASE_HEALTH, IndexerStorage.MOCK)
    )
    # Insert a None-value into the mock-indexer to simulate a rate-limit.
    message_processor._indexer.indexer._strings[1]["rate_limited_test"] = None

    with caplog.at_level(logging.ERROR):
        new_batch = message_processor.process_messages(outer_message=outer_message)

    # we expect just the counter_payload msg to be left, as that one didn't
    # cause/depend on string writes that have been rate limited
    expected_msg = message_batch[0]
    expected_new_batch = [
        Message(
            BrokerValue(
                KafkaPayload(
                    None,
                    json.dumps(__translated_payload(counter_payload)).encode("utf-8"),
                    [("metric_type", "c")],
                ),
                expected_msg.value.partition,
                expected_msg.value.offset,
                expected_msg.value.timestamp,
            )
        )
    ]
    compare_message_batches_ignoring_metadata(new_batch, expected_new_batch)
    assert "dropped_message" in caplog.text


def test_process_messages_cardinality_limited(
    caplog, settings, monkeypatch, set_sentry_option
) -> None:
    """
    Test that the message processor correctly calls the cardinality limiter.
    """
    settings.SENTRY_METRICS_INDEXER_DEBUG_LOG_SAMPLE_RATE = 1.0

    # set any limit at all to ensure we actually use the underlying rate limiter
    with set_sentry_option(
        "sentry-metrics.cardinality-limiter.limits.releasehealth.per-org",
        [{"window_seconds": 3600, "granularity_seconds": 60, "limit": 0}],
    ), set_sentry_option("sentry-metrics.cardinality-limiter-rh.orgs-rollout-rate", 1.0):

        class MockCardinalityLimiter(CardinalityLimiter):
            def check_within_quotas(self, requested_quotas):
                # Grant nothing, limit everything
                return 123, []

            def use_quotas(self, grants, timestamp):
                pass

        monkeypatch.setitem(
            cardinality_limiter_factory.rate_limiters,
            "releasehealth",
            TimeseriesCardinalityLimiter("releasehealth", MockCardinalityLimiter()),
        )

        message_payloads = [counter_payload, distribution_payload, set_payload]
        message_batch = [
            Message(
                BrokerValue(
                    KafkaPayload(None, json.dumps(payload).encode("utf-8"), []),
                    Partition(Topic("topic"), 0),
                    i + 1,
                    datetime.now(),
                )
            )
            for i, payload in enumerate(message_payloads)
        ]

        last = message_batch[-1]
        outer_message = Message(Value(message_batch, last.committable))

        with caplog.at_level(logging.ERROR):
            new_batch = MESSAGE_PROCESSOR.process_messages(outer_message=outer_message)

        compare_message_batches_ignoring_metadata(new_batch, [])

        assert "dropped_message" in caplog.text


def test_valid_metric_name() -> None:
    assert valid_metric_name("") is True
    assert valid_metric_name("blah") is True
    assert valid_metric_name("invalid" * 200) is False


def test_invalid_metric_tags() -> None:
    bad_tag = "invalid" * 200
    tags = {"environment": "", "release": "good_tag"}
    assert invalid_metric_tags(tags) == []
    assert invalid_metric_tags(tags) == []
    tags["release"] = bad_tag
    assert invalid_metric_tags(tags) == [bad_tag]
    tags["release"] = None
    assert invalid_metric_tags(tags) == [None]


def test_process_messages_is_pickleable():
    # needed so that the parallel transform step starts up properly
    pickle.dumps(MESSAGE_PROCESSOR.process_messages)
