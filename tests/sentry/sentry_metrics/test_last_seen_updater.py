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
    _last_seen_updater_processing_factory,
    _update_stale_last_seen,
    retrieve_db_read_keys,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import override_options


def mixed_payload():
    return bytes(
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


def empty_payload():
    return bytes(
        """
        {
        }
        """,
        encoding="utf-8",
    )


def bad_payload():
    return bytes(
        "not JSON",
        encoding="utf-8",
    )


def headerless_kafka_payload(payload_bytes):
    return KafkaPayload(key=bytes("fake-key", encoding="utf-8"), value=payload_bytes, headers=[])


def kafka_message(kafka_payload):
    return Message(
        partition=Partition(Topic("fake-topic"), 1),
        offset=1,
        payload=kafka_payload,
        timestamp=datetime.now(),
    )


def test_retrieve_db_read_keys_meta_field_present_with_db_keys():
    message = kafka_message(headerless_kafka_payload(mixed_payload()))
    key_set = retrieve_db_read_keys(message)
    assert key_set == {2000, 2001, 2002}


def test_retrieve_db_read_keys_meta_field_not_present():
    message = kafka_message(headerless_kafka_payload(empty_payload()))
    key_set = retrieve_db_read_keys(message)
    assert key_set == set()


def test_retrieve_db_read_keys_meta_field_bad_json():
    message = kafka_message(headerless_kafka_payload(bad_payload()))
    key_set = retrieve_db_read_keys(message)
    assert key_set == set()


class TestLastSeenUpdaterEndToEnd(TestCase):
    @staticmethod
    def processing_factory():
        return _last_seen_updater_processing_factory(max_batch_time=1.0, max_batch_size=1)

    def setUp(self):
        self.org_id = 1234
        self.stale_id = 2001
        self.fresh_id = 2002
        self.stale_last_seen = timezone.now() - timedelta(days=1)
        self.fresh_last_seen = timezone.now() - timedelta(hours=1)
        StringIndexer.objects.create(
            organization_id=self.org_id,
            string="e2e_0",
            id=self.stale_id,
            last_seen=self.stale_last_seen,
        )
        StringIndexer.objects.create(
            organization_id=self.org_id,
            string="e2e_1",
            id=self.fresh_id,
            last_seen=self.fresh_last_seen,
        )

    def tearDown(self):
        StringIndexer.objects.filter(id=self.fresh_id).delete()
        StringIndexer.objects.filter(id=self.stale_id).delete()

    def test_basic_flow(self):
        with override_options({"sentry-metrics.last-seen-updater.accept-rate": 1.0}):
            # we can't use fixtures with unittest.TestCase
            message = kafka_message(headerless_kafka_payload(mixed_payload()))
            processing_strategy = self.processing_factory().create(lambda x: None)
            processing_strategy.submit(message)
            processing_strategy.poll()
            processing_strategy.join(1)

        fresh_item = StringIndexer.objects.get(id=self.fresh_id)
        assert fresh_item.last_seen == self.fresh_last_seen

        stale_item = StringIndexer.objects.get(id=self.stale_id)
        # without doing a bunch of mocking around time objects, stale_item.last_seen
        # should be approximately equal to timezone.now() but they won't be perfectly equal
        assert (timezone.now() - stale_item.last_seen) < timedelta(seconds=30)

    def test_message_processes_after_bad_message(self):
        with override_options({"sentry-metrics.last-seen-updater.accept-rate": 1.0}):
            ok_message = kafka_message(headerless_kafka_payload(mixed_payload()))
            bad_message = kafka_message(headerless_kafka_payload(bad_payload()))
            processing_strategy = self.processing_factory().create(lambda x: None)
            processing_strategy.submit(bad_message)
            processing_strategy.submit(ok_message)
            processing_strategy.poll()
            processing_strategy.join(1)

        stale_item = StringIndexer.objects.get(id=self.stale_id)
        assert stale_item.last_seen > self.stale_last_seen


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
