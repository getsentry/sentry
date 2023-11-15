from __future__ import annotations

import logging
import pickle
import re
import time
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Dict, List, MutableMapping, Sequence, Union
from unittest.mock import Mock, call

import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.dlq import InvalidMessage
from arroyo.processing.strategies import MessageRejected
from arroyo.types import BrokerValue, Message, Partition, Topic, Value

from sentry.ratelimits.cardinality import CardinalityLimiter
from sentry.sentry_metrics.aggregation_option_registry import get_aggregation_option
from sentry.sentry_metrics.configuration import IndexerStorage, UseCaseKey, get_ingest_config
from sentry.sentry_metrics.consumers.indexer.batch import valid_metric_name
from sentry.sentry_metrics.consumers.indexer.common import (
    BatchMessages,
    IndexerOutputMessageBatch,
    MetricsBatchBuilder,
)
from sentry.sentry_metrics.consumers.indexer.processing import MessageProcessor
from sentry.sentry_metrics.indexer.limiters.cardinality import (
    TimeseriesCardinalityLimiter,
    cardinality_limiter_factory,
)
from sentry.sentry_metrics.indexer.mock import MockIndexer, RawSimpleIndexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.utils import json

logger = logging.getLogger(__name__)


pytestmark = pytest.mark.sentry_metrics

MESSAGE_PROCESSOR = MessageProcessor(
    get_ingest_config(UseCaseKey.PERFORMANCE, IndexerStorage.POSTGRES)
)

BROKER_TIMESTAMP = datetime.now(tz=timezone.utc)


@pytest.fixture(autouse=True)
def update_sentry_settings(settings):
    settings.SENTRY_METRICS_INDEXER_RAISE_VALIDATION_ERRORS = True


def compare_messages_ignoring_mapping_metadata(actual: Message, expected: Message) -> None:
    assert actual.committable == expected.committable

    actual_payload = actual.payload
    expected_payload = expected.payload

    if isinstance(actual_payload, InvalidMessage):
        assert actual_payload == expected_payload
        return

    assert actual_payload.key == expected_payload.key

    actual_headers_without_mapping_sources = [
        (k, v.encode()) for k, v in actual_payload.headers if k != "mapping_sources"
    ]
    assert actual_headers_without_mapping_sources == expected_payload.headers

    actual_deserialized = json.loads(actual_payload.value)
    expected_deserialized = json.loads(expected_payload.value)
    del actual_deserialized["mapping_meta"]
    assert actual_deserialized == expected_deserialized


def compare_message_batches_ignoring_metadata(
    actual: IndexerOutputMessageBatch, expected: Sequence[Message]
) -> None:
    assert len(actual.data) == len(expected)
    for a, e in zip(actual.data, expected):
        compare_messages_ignoring_mapping_metadata(a, e)


def _batch_message_set_up(next_step: Mock, max_batch_time: float = 100.0, max_batch_size: int = 2):
    # batch time is in seconds
    batch_messages_step = BatchMessages(
        next_step=next_step, max_batch_time=max_batch_time, max_batch_size=max_batch_size
    )

    message1 = Message(
        BrokerValue(
            KafkaPayload(None, b"some value", []),
            Partition(Topic("topic"), 0),
            1,
            BROKER_TIMESTAMP,
        )
    )
    message2 = Message(
        BrokerValue(
            KafkaPayload(None, b"another value", []),
            Partition(Topic("topic"), 0),
            2,
            BROKER_TIMESTAMP,
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
counter_payloads: list[dict[str, Any]] = [
    {
        "name": f"c:{use_case.value}/alert@none",
        "tags": {
            "environment": "production",
            "session.status": "init",
        },
        "timestamp": ts,
        "type": b"c",
        "value": 1.0,
        "org_id": 1,
        "project_id": 3,
        "retention_days": 90,
    }
    for use_case in UseCaseID
    if use_case is not UseCaseID.SESSIONS
]
distribution_payloads: list[dict[str, Any]] = [
    {
        "name": f"d:{use_case.value}/alert@none",
        "tags": {
            "environment": "production",
            "session.status": "healthy",
        },
        "timestamp": ts,
        "type": b"d",
        "value": [4, 5, 6],
        "org_id": 1,
        "project_id": 3,
        "retention_days": 90,
    }
    for use_case in UseCaseID
    if use_case is not UseCaseID.SESSIONS
]

set_payloads: list[dict[str, Any]] = [
    {
        "name": f"s:{use_case.value}/alert@none",
        "tags": {
            "environment": "production",
            "session.status": "errored",
        },
        "timestamp": ts,
        "type": b"s",
        "value": [3],
        "org_id": 1,
        "project_id": 3,
        "retention_days": 90,
    }
    for use_case in UseCaseID
    if use_case is not UseCaseID.SESSIONS
]


def __translated_payload(
    payload, indexer=None
) -> Dict[str, Union[str, int, List[int], MutableMapping[int, int]]]:
    """
    Translates strings to ints using the MockIndexer
    in addition to adding the retention_days

    """
    indexer = indexer or MESSAGE_PROCESSOR._indexer
    MRI_RE_PATTERN = re.compile("^([c|s|d|g|e]):([a-zA-Z0-9_]+)/.*$")

    payload = deepcopy(payload)
    org_id = payload["org_id"]
    matched_mri = MRI_RE_PATTERN.match(payload["name"])
    assert matched_mri is not None
    use_case_id = UseCaseID(matched_mri.group(2))

    new_tags = {
        indexer.resolve(use_case_id=use_case_id, org_id=org_id, string=k): v
        for k, v in payload["tags"].items()
    }

    agg_option = get_aggregation_option(payload["name"])
    if agg_option:
        payload["aggregation_option"] = agg_option

    payload["metric_id"] = indexer.resolve(
        use_case_id=use_case_id, org_id=org_id, string=payload["name"]
    )
    payload["retention_days"] = 90
    payload["tags"] = new_tags
    payload["use_case_id"] = use_case_id.value
    payload["sentry_received_timestamp"] = BROKER_TIMESTAMP.timestamp()
    payload["version"] = 2

    payload.pop("unit", None)
    del payload["name"]
    return payload


@pytest.mark.django_db
def test_process_messages() -> None:
    message_payloads = counter_payloads + distribution_payloads + set_payloads
    message_batch = [
        Message(
            BrokerValue(
                KafkaPayload(None, json.dumps(payload).encode("utf-8"), []),
                Partition(Topic("topic"), 0),
                i + 1,
                BROKER_TIMESTAMP,
            )
        )
        for i, payload in enumerate(message_payloads)
    ]
    # the outer message uses the last message's partition, offset, and timestamp
    last = message_batch[-1]

    outer_message = Message(Value(message_batch, last.committable))

    new_batch = MESSAGE_PROCESSOR.process_messages(outer_message=outer_message)
    expected_new_batch = []
    for i, m in enumerate(message_batch):
        assert isinstance(m.value, BrokerValue)
        expected_new_batch.append(
            Message(
                BrokerValue(
                    KafkaPayload(
                        None,
                        json.dumps(__translated_payload(message_payloads[i])).encode("utf-8"),
                        [
                            ("metric_type", message_payloads[i]["type"]),
                        ],
                    ),
                    m.value.partition,
                    m.value.offset,
                    m.value.timestamp,
                )
            )
        )

    compare_message_batches_ignoring_metadata(new_batch, expected_new_batch)


@pytest.mark.django_db
def test_process_messages_default_card_rollout(set_sentry_option) -> None:
    message_payloads = counter_payloads + distribution_payloads + set_payloads
    message_batch = [
        Message(
            BrokerValue(
                KafkaPayload(None, json.dumps(payload).encode("utf-8"), []),
                Partition(Topic("topic"), 0),
                i + 1,
                BROKER_TIMESTAMP,
            )
        )
        for i, payload in enumerate(message_payloads)
    ]
    # the outer message uses the last message's partition, offset, and timestamp
    last = message_batch[-1]

    outer_message = Message(Value(message_batch, last.committable))

    with set_sentry_option(
        "sentry-metrics.cardinality-limiter.orgs-rollout-rate",
        1.0,
    ):
        new_batch = MESSAGE_PROCESSOR.process_messages(outer_message=outer_message)

    assert len(new_batch.data) == len(message_batch)


invalid_payloads = [
    (
        {
            "name": "c:transactions/alert@none",
            "tags": {
                "environment" * 21: "production",
                "session.status": "errored",
            },
            "timestamp": ts,
            "type": "s",
            "value": [3],
            "org_id": 1,
            "project_id": 3,
            "retention_days": 90,
        },
        "invalid_tags",
        True,
    ),
    (
        {
            "name": "c:transactions/alert@none" * 21,
            "tags": {
                "environment": "production",
                "session.status": "errored",
            },
            "timestamp": ts,
            "type": "s",
            "value": [3],
            "org_id": 1,
            "project_id": 3,
            "retention_days": 90,
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


@pytest.mark.django_db
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
                KafkaPayload(None, json.dumps(counter_payloads[0]).encode("utf-8"), []),
                Partition(Topic("topic"), 0),
                0,
                BROKER_TIMESTAMP,
            )
        ),
        Message(
            BrokerValue(
                KafkaPayload(None, formatted_payload, []),
                Partition(Topic("topic"), 0),
                1,
                BROKER_TIMESTAMP,
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
                    json.dumps(__translated_payload(counter_payloads[0])).encode("utf-8"),
                    [("metric_type", b"c")],
                ),
                expected_msg.committable,
            )
        ),
        Message(
            Value(
                InvalidMessage(Partition(Topic("topic"), 0), 1),
                message_batch[1].committable,
            )
        ),
    ]
    compare_message_batches_ignoring_metadata(new_batch, expected_new_batch)
    assert error_text in caplog.text


@pytest.mark.django_db
def test_process_messages_rate_limited(caplog, settings) -> None:
    """
    Test handling of `None`-values coming from the indexer service, which
    happens when postgres writes are being rate-limited.
    """
    settings.SENTRY_METRICS_INDEXER_DEBUG_LOG_SAMPLE_RATE = 1.0
    rate_limited_payload = deepcopy(distribution_payloads[0])
    rate_limited_payload["tags"]["rate_limited_test"] = "true"

    message_batch = [
        Message(
            BrokerValue(
                KafkaPayload(None, json.dumps(counter_payloads[0]).encode("utf-8"), []),
                Partition(Topic("topic"), 0),
                0,
                BROKER_TIMESTAMP,
            )
        ),
        Message(
            BrokerValue(
                KafkaPayload(None, json.dumps(rate_limited_payload).encode("utf-8"), []),
                Partition(Topic("topic"), 0),
                1,
                BROKER_TIMESTAMP,
            )
        ),
    ]
    # the outer message uses the last message's partition, offset, and timestamp
    last = message_batch[-1]
    outer_message = Message(Value(message_batch, last.committable))

    message_processor = MessageProcessor(
        get_ingest_config(UseCaseKey.PERFORMANCE, IndexerStorage.MOCK)
    )
    # Insert a None-value into the mock-indexer to simulate a rate-limit.
    mock_indexer = message_processor._indexer
    assert isinstance(mock_indexer, MockIndexer)
    raw_simple_string_indexer = mock_indexer.indexer
    assert isinstance(raw_simple_string_indexer, RawSimpleIndexer)
    rgx = re.compile("^([c|s|d|g|e]):([a-zA-Z0-9_]+)/.*$").match(distribution_payloads[0]["name"])
    assert rgx is not None
    raw_simple_string_indexer._strings[UseCaseID(rgx.group(2))][1]["rate_limited_test"] = None

    with caplog.at_level(logging.ERROR):
        new_batch = message_processor.process_messages(outer_message=outer_message)

    # we expect just the counter_payload msg to be left, as that one didn't
    # cause/depend on string writes that have been rate limited
    expected_msg = message_batch[0]
    assert isinstance(expected_msg.value, BrokerValue)
    expected_new_batch = [
        Message(
            BrokerValue(
                KafkaPayload(
                    None,
                    json.dumps(
                        __translated_payload(counter_payloads[0], message_processor._indexer)
                    ).encode("utf-8"),
                    [("metric_type", b"c")],
                ),
                expected_msg.value.partition,
                expected_msg.value.offset,
                expected_msg.value.timestamp,
            )
        )
    ]
    compare_message_batches_ignoring_metadata(new_batch, expected_new_batch)
    assert "dropped_message" in caplog.text


@pytest.mark.django_db
def test_process_messages_cardinality_limited(
    caplog, settings, monkeypatch, set_sentry_option
) -> None:
    """
    Test that the message processor correctly calls the cardinality limiter.
    """
    settings.SENTRY_METRICS_INDEXER_DEBUG_LOG_SAMPLE_RATE = 1.0

    # set any limit at all to ensure we actually use the underlying rate limiter
    with set_sentry_option(
        "sentry-metrics.cardinality-limiter.limits.performance.per-org",
        [{"window_seconds": 3600, "granularity_seconds": 60, "limit": 0}],
    ), set_sentry_option("sentry-metrics.cardinality-limiter.orgs-rollout-rate", 1.0):

        class MockCardinalityLimiter(CardinalityLimiter):
            def check_within_quotas(self, requested_quotas):
                # Grant nothing, limit everything
                return 123, []

            def use_quotas(self, grants, timestamp):
                pass

        monkeypatch.setitem(
            cardinality_limiter_factory.rate_limiters,
            "performance",
            TimeseriesCardinalityLimiter("performance", MockCardinalityLimiter()),
        )

        message_payloads = counter_payloads + distribution_payloads + set_payloads
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


def test_valid_metric_name() -> None:
    assert valid_metric_name("") is True
    assert valid_metric_name("blah") is True
    assert valid_metric_name("invalid" * 200) is False


def test_process_messages_is_pickleable():
    # needed so that the parallel transform step starts up properly
    pickle.dumps(MESSAGE_PROCESSOR.process_messages)
