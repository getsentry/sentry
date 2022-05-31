from datetime import datetime, timedelta
from unittest.mock import Mock

import pytest
from arroyo import Message, Partition, Topic
from arroyo.backends.kafka import KafkaPayload
from django.utils import timezone

from sentry.metrics.dummy import DummyMetricsBackend
from sentry.sentry_metrics.indexer.models import StringIndexer
from sentry.sentry_metrics.last_seen_updater import (
    LastSeenUpdaterMessageFilter,
    _update_stale_last_seen,
    retrieve_db_read_keys,
)
from sentry.testutils.cases import TestCase
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


class TestFilterMethod:
    @pytest.fixture
    def message_filter(self):
        return LastSeenUpdaterMessageFilter(DummyMetricsBackend())

    def empty_message_with_headers(self, headers):
        payload = KafkaPayload(headers=headers, key=Mock(), value=Mock())
        return Message(partition=Mock(), offset=0, payload=payload, timestamp=datetime.utcnow())

    def test_message_filter_no_header(self, message_filter):
        with override_options({"sentry-metrics.last-seen-updater.accept-rate": 1.0}):
            message = self.empty_message_with_headers([])
            assert not message_filter.should_drop(message)

    def test_message_filter_header_contains_d(self, message_filter):
        with override_options({"sentry-metrics.last-seen-updater.accept-rate": 1.0}):
            message = self.empty_message_with_headers([("mapping_sources", "hcd")])
            assert not message_filter.should_drop(message)

    def test_message_filter_header_contains_no_d(self, message_filter):
        with override_options({"sentry-metrics.last-seen-updater.accept-rate": 1.0}):
            message = self.empty_message_with_headers([("mapping_sources", "fhc")])
            assert message_filter.should_drop(message)


class TestCollectMethod(TestCase):
    def test_last_seen_update_of_old_item(self):
        update_time = timezone.now()
        stale_item = StringIndexer.objects.create(
            organization_id=1234,
            string="test_123",
            last_seen=timezone.now() - timedelta(days=1),
        )
        assert _update_stale_last_seen({stale_item.id}, new_last_seen_time=update_time) == 1
        reloaded_stale_item = StringIndexer.objects.get(id=stale_item.id)
        assert reloaded_stale_item.last_seen == update_time

    def test_last_seen_update_of_new_item_skips(self):
        last_seen_original = timezone.now()
        update_time = timezone.now() + timedelta(hours=1)
        fresh_item = StringIndexer.objects.create(
            organization_id=1234,
            string="test_123",
            last_seen=last_seen_original,
        )
        assert _update_stale_last_seen({fresh_item.id}, new_last_seen_time=update_time) == 0
        reloaded_fresh_item = StringIndexer.objects.get(id=fresh_item.id)
        assert reloaded_fresh_item.last_seen == last_seen_original

    def test_mixed_fresh_and_stale_items(self):
        last_seen_original = timezone.now()
        update_time = timezone.now() + timedelta(hours=1)

        fresh_item = StringIndexer.objects.create(
            organization_id=1234,
            string="test_123",
            last_seen=last_seen_original,
        )
        stale_item = StringIndexer.objects.create(
            organization_id=1234,
            string="test_abc",
            last_seen=timezone.now() - timedelta(days=1),
        )

        assert (
            _update_stale_last_seen({fresh_item.id, stale_item.id}, new_last_seen_time=update_time)
            == 1
        )
        reloaded_fresh_item = StringIndexer.objects.get(id=fresh_item.id)
        assert reloaded_fresh_item.last_seen == last_seen_original
        reloaded_stale_item = StringIndexer.objects.get(id=stale_item.id)
        assert reloaded_stale_item.last_seen == update_time
