from datetime import datetime
from unittest.mock import Mock

import pytest
from arroyo import Message, Partition, Topic
from arroyo.backends.kafka import KafkaPayload

from sentry.metrics.dummy import DummyMetricsBackend
from sentry.sentry_metrics.last_seen_updater import (
    LastSeenUpdaterMessageFilter,
    retrieve_db_read_keys,
)
from sentry.testutils.helpers import override_options


def test_retrieve_db_read_keys_meta_field_present_with_db_keys():
    payload_bytes = bytes(
        """
        {
            "mapping_meta": {
                "c": {
                    "1001": "qwerty"
                },
                "f": {
                    "1002": "asdf"
                },
                "d": {
                    "2000": "abc",
                    "2001": "def",
                    "2002": "ghi"
                },
                "h": {
                    "3": "constant"
                }
            }
        }
        """,
        encoding="utf-8",
    )
    message_payload = KafkaPayload(
        key=bytes("fake-key", encoding="utf-8"), value=payload_bytes, headers=[]
    )

    message = Message(
        partition=Partition(Topic("fake-topic"), 1),
        offset=1,
        payload=message_payload,
        timestamp=datetime.now(),
    )
    key_set = retrieve_db_read_keys(message)
    assert key_set == {2000, 2001, 2002}


@pytest.fixture
def message_filter():
    return LastSeenUpdaterMessageFilter(DummyMetricsBackend())


def empty_message_with_headers(headers):
    payload = KafkaPayload(headers=headers, key=Mock(), value=Mock())
    return Message(partition=Mock(), offset=0, payload=payload, timestamp=datetime.utcnow())


def test_message_filter_no_header(message_filter):
    with override_options({"sentry-metrics.last-seen-updater.accept-rate": 1.0}):
        message = empty_message_with_headers([])
        assert not message_filter.should_drop(message)


def test_message_filter_header_contains_d(message_filter):
    with override_options({"sentry-metrics.last-seen-updater.accept-rate": 1.0}):
        message = empty_message_with_headers([("mapping_sources", "hcd")])
        assert not message_filter.should_drop(message)


def test_message_filter_header_contains_no_d(message_filter):
    with override_options({"sentry-metrics.last-seen-updater.accept-rate": 1.0}):
        message = empty_message_with_headers([("mapping_sources", "fhc")])
        assert message_filter.should_drop(message)
