import logging
import time
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

from django.conf import settings

from sentry.event_manager import EventManager
from sentry.eventstream.errors.backend import (
    ErrorsInsertData,
    KafkaErrorsEventStreamAPI,
    SnubaErrorsEventStreamAPI,
)
from sentry.eventstream.transactions.backend import (
    KafkaTransactionsEventStreamAPI,
    SnubaTransactionsEventStreamAPI,
    TransactionsInsertData,
)
from sentry.testutils import SnubaTestCase, TestCase
from sentry.utils import json, snuba
from sentry.utils.samples import load_data


class TransactionsEventStreamTest(TestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()

        self.kafka_eventstream = KafkaTransactionsEventStreamAPI()
        self.kafka_eventstream._backend.producer = Mock()

    def __build_transaction_event(self):
        manager = EventManager(load_data("transaction"))
        manager.normalize()
        return manager.save(self.project.id)

    def __produce_event(self, insert_data: TransactionsInsertData):
        self.kafka_eventstream.insert(insert_data)

        produce_args, produce_kwargs = list(
            self.kafka_eventstream._backend.producer.produce.call_args
        )
        assert not produce_args
        assert produce_kwargs["topic"] == settings.KAFKA_TRANSACTIONS
        # we don't semantically partition on transactions
        assert produce_kwargs["key"] is None

        version, type_, payload1, payload2 = json.loads(produce_kwargs["value"])
        assert version == 2
        assert type_ == "insert"

        # insert what would have been the Kafka payload directly
        # into Snuba, expect an HTTP 200 and for the event to now exist
        snuba_eventstream = SnubaTransactionsEventStreamAPI()
        snuba_eventstream._backend.send(
            self.project.id,
            "insert",
            (payload1, payload2),
        )

    @patch("sentry.eventstream.transactions.insert")
    def test_insert(self, mock_eventstream_insert):
        now = datetime.utcnow()
        event = self.__build_transaction_event()

        insert_data = TransactionsInsertData(
            event=event, received_timestamp=event.data["received"], skip_consume=False
        )

        self.__produce_event(insert_data)
        result = snuba.raw_query(
            dataset=snuba.Dataset.Transactions,
            start=now - timedelta(days=1),
            end=now + timedelta(days=1),
            selected_columns=["event_id"],
            groupby=None,
            filter_keys={"project_id": [self.project.id], "event_id": [event.event_id]},
        )
        assert len(result["data"]) == 1


class ErrorsEventStreamTest(TestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()

        self.kafka_eventstream = KafkaErrorsEventStreamAPI()
        self.kafka_eventstream._backend.producer = Mock()

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

    def __produce_event(self, insert_data: TransactionsInsertData):
        # pass arguments on to Kafka EventManager
        self.kafka_eventstream.insert(insert_data)

        produce_args, produce_kwargs = list(
            self.kafka_eventstream._backend.producer.produce.call_args
        )
        assert not produce_args
        assert produce_kwargs["topic"] == settings.KAFKA_EVENTS
        assert produce_kwargs["key"] == str(self.project.id).encode("utf-8")

        version, type_, payload1, payload2 = json.loads(produce_kwargs["value"])
        assert version == 2
        assert type_ == "insert"

        # insert what would have been the Kafka payload directly
        # into Snuba, expect an HTTP 200 and for the event to now exist
        snuba_eventstream = SnubaErrorsEventStreamAPI()
        snuba_eventstream._backend.send(
            self.project.id,
            "insert",
            (payload1, payload2),
        )

    @patch("sentry.eventstream.errors.insert")
    def test_insert(self, mock_eventstream_insert):
        now = datetime.utcnow()

        event = self.__build_event(now)

        insert_data = ErrorsInsertData(
            event=event,
            group=event.group,
            is_new=True,
            is_new_group_environment=True,
            is_regression=False,
            primary_hash="acbd18db4cc2f85cedef654fccc4a4d8",
            received_timestamp=event.data["received"],
            skip_consume=False,
        )

        # verify eventstream was called by EventManager
        insert_args, insert_kwargs = list(mock_eventstream_insert.call_args)
        assert not insert_args
        assert insert_kwargs == {"data": insert_data}

        self.__produce_event(insert_data)
        assert (
            snuba.query(
                start=now - timedelta(days=1),
                end=now + timedelta(days=1),
                groupby=["project_id"],
                filter_keys={"project_id": [self.project.id]},
            ).get(self.project.id, 0)
            == 1
        )
