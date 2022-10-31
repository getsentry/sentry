import logging
import time
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

from django.conf import settings

from sentry.event_manager import EventManager
from sentry.eventstream.kafka import KafkaEventStream
from sentry.eventstream.snuba import SnubaEventStream
from sentry.testutils import SnubaTestCase, TestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils import json, snuba
from sentry.utils.samples import load_data


@region_silo_test
class SnubaEventStreamTest(TestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()

        self.kafka_eventstream = KafkaEventStream()
        self.producer_mock = Mock()
        self.kafka_eventstream.get_producer = Mock(return_value=self.producer_mock)

    def __build_event(self, timestamp):
        raw_event = {
            "event_id": "a" * 32,
            "message": "foo",
            "timestamp": time.mktime(timestamp.timetuple()),
            "level": logging.ERROR,
            "logger": "default",
            "tags": [],
        }
        manager = EventManager(raw_event)
        manager.normalize()
        return manager.save(self.project.id)

    def __build_transaction_event(self):
        manager = EventManager(load_data("transaction"))
        manager.normalize()
        return manager.save(self.project.id)

    def __produce_event(self, *insert_args, **insert_kwargs):

        is_transaction_event = insert_kwargs["event"].get_event_type() == "transaction"

        # pass arguments on to Kafka EventManager
        self.kafka_eventstream.insert(*insert_args, **insert_kwargs)

        producer = self.producer_mock

        produce_args, produce_kwargs = list(producer.produce.call_args)
        assert not produce_args
        if is_transaction_event:
            assert produce_kwargs["topic"] == settings.KAFKA_TRANSACTIONS
            assert produce_kwargs["key"] is None
        else:
            assert produce_kwargs["topic"] == settings.KAFKA_EVENTS
            assert produce_kwargs["key"] == str(self.project.id).encode("utf-8")

        version, type_, payload1, payload2 = json.loads(produce_kwargs["value"])
        assert version == 2
        assert type_ == "insert"

        # insert what would have been the Kafka payload directly
        # into Snuba, expect an HTTP 200 and for the event to now exist
        snuba_eventstream = SnubaEventStream()
        snuba_eventstream._send(
            self.project.id,
            "insert",
            (payload1, payload2),
            is_transaction_event=is_transaction_event,
        )

    def __produce_payload(self, *insert_args, **insert_kwargs):

        # pass arguments on to Kafka EventManager
        self.kafka_eventstream.insert(*insert_args, **insert_kwargs)

        producer = self.producer_mock

        produce_args, produce_kwargs = list(producer.produce.call_args)
        assert not produce_args

        version, type_, payload1, payload2 = json.loads(produce_kwargs["value"])

        # only return headers and body payload
        return produce_kwargs["headers"], payload2

    @patch("sentry.eventstream.insert", autospec=True)
    def test(self, mock_eventstream_insert):
        now = datetime.utcnow()

        event = self.__build_event(now)

        # verify eventstream was called by EventManager
        insert_args, insert_kwargs = list(mock_eventstream_insert.call_args)
        assert not insert_args

        group_state = {
            "is_new_group_environment": True,
            "is_new": True,
            "is_regression": False,
        }

        assert insert_kwargs == {
            "event": event,
            **group_state,
            "primary_hash": "acbd18db4cc2f85cedef654fccc4a4d8",
            "skip_consume": False,
            "received_timestamp": event.data["received"],
            "group_states": [{"id": event.groups[0].id, **group_state}],
        }

        self.__produce_event(*insert_args, **insert_kwargs)
        assert (
            snuba.query(
                start=now - timedelta(days=1),
                end=now + timedelta(days=1),
                groupby=["project_id"],
                filter_keys={"project_id": [self.project.id]},
            ).get(self.project.id, 0)
            == 1
        )

    @patch("sentry.eventstream.insert", autospec=True)
    def test_issueless(self, mock_eventstream_insert):
        now = datetime.utcnow()
        event = self.__build_transaction_event()
        event.group_id = None
        insert_args = ()
        insert_kwargs = {
            "event": event,
            "is_new_group_environment": True,
            "is_new": True,
            "is_regression": False,
            "primary_hash": "acbd18db4cc2f85cedef654fccc4a4d8",
            "skip_consume": False,
            "received_timestamp": event.data["received"],
        }

        self.__produce_event(*insert_args, **insert_kwargs)
        result = snuba.raw_query(
            dataset=snuba.Dataset.Transactions,
            start=now - timedelta(days=1),
            end=now + timedelta(days=1),
            selected_columns=["event_id"],
            groupby=None,
            filter_keys={"project_id": [self.project.id], "event_id": [event.event_id]},
        )
        assert len(result["data"]) == 1

    @patch("sentry.eventstream.insert", autospec=True)
    def test_multiple_groups(self, mock_eventstream_insert):
        now = datetime.utcnow()
        event = self.__build_transaction_event()
        event.group_id = None
        event.groups = [self.group]
        insert_args = ()
        group_state = {
            "is_new_group_environment": True,
            "is_new": True,
            "is_regression": False,
        }
        insert_kwargs = {
            "event": event,
            **group_state,
            "primary_hash": "acbd18db4cc2f85cedef654fccc4a4d8",
            "skip_consume": False,
            "received_timestamp": event.data["received"],
            "group_states": [{"id": event.groups[0].id, **group_state}],
        }

        self.__produce_event(*insert_args, **insert_kwargs)
        result = snuba.raw_query(
            dataset=snuba.Dataset.Transactions,
            start=now - timedelta(days=1),
            end=now + timedelta(days=1),
            selected_columns=["event_id", "group_ids"],
            groupby=None,
            filter_keys={"project_id": [self.project.id], "event_id": [event.event_id]},
        )
        assert len(result["data"]) == 1
        assert result["data"][0]["group_ids"] == [self.group.id]

    @patch("sentry.eventstream.snuba.logger")
    def test_invalid_groupevent_passed(self, logger):
        event = self.__build_transaction_event()
        event.group_id = None
        event.group_ids = [self.group.id]
        insert_args = ()
        insert_kwargs = {
            "event": event.for_group(self.group),
            "is_new_group_environment": True,
            "is_new": True,
            "is_regression": False,
            "primary_hash": "acbd18db4cc2f85cedef654fccc4a4d8",
            "skip_consume": False,
            "received_timestamp": event.data["received"],
        }
        self.kafka_eventstream.insert(*insert_args, **insert_kwargs)
        assert not self.producer_mock.produce.called
        logger.error.assert_called_with(
            "`GroupEvent` passed to `EventStream.insert`. Only `Event` is allowed here.",
            exc_info=True,
        )

    @patch("sentry.eventstream.insert", autospec=True)
    def test_error_queue(self, mock_eventstream_insert):
        now = datetime.utcnow()

        event = self.__build_event(now)

        # verify eventstream was called by EventManager
        insert_args, insert_kwargs = list(mock_eventstream_insert.call_args)
        assert not insert_args

        group_state = {
            "is_new_group_environment": True,
            "is_new": True,
            "is_regression": False,
        }

        assert insert_kwargs == {
            "event": event,
            **group_state,
            "primary_hash": "acbd18db4cc2f85cedef654fccc4a4d8",
            "skip_consume": False,
            "received_timestamp": event.data["received"],
            "group_states": [{"id": event.groups[0].id, **group_state}],
        }

        headers, body = self.__produce_payload(*insert_args, **insert_kwargs)

        assert ("queue", b"post_process_errors") in headers
        assert body["queue"] == "post_process_errors"

    @patch("sentry.eventstream.insert", autospec=True)
    def test_transaction_queue(self, mock_eventstream_insert):
        event = self.__build_transaction_event()
        event.group_id = None
        event.groups = [self.group]
        insert_args = ()
        group_state = {
            "is_new_group_environment": True,
            "is_new": True,
            "is_regression": False,
        }
        insert_kwargs = {
            "event": event,
            **group_state,
            "primary_hash": "acbd18db4cc2f85cedef654fccc4a4d8",
            "skip_consume": False,
            "received_timestamp": event.data["received"],
            "group_states": [{"id": event.groups[0].id, **group_state}],
        }

        headers, body = self.__produce_payload(*insert_args, **insert_kwargs)

        assert ("queue", b"post_process_transactions") in headers
        assert body["queue"] == "post_process_transactions"
