from __future__ import absolute_import

from datetime import datetime, timedelta
import six
import time
import logging
from sentry.utils.compat.mock import patch, Mock

from sentry.event_manager import EventManager
from sentry.eventstream.kafka import KafkaEventStream
from sentry.eventstream.snuba import SnubaEventStream
from sentry.testutils import SnubaTestCase, TestCase
from sentry.utils import snuba, json


class SnubaEventStreamTest(TestCase, SnubaTestCase):
    def setUp(self):
        super(SnubaEventStreamTest, self).setUp()

        self.kafka_eventstream = KafkaEventStream()
        self.kafka_eventstream.producer = Mock()

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

    def __produce_event(self, *insert_args, **insert_kwargs):
        # pass arguments on to Kafka EventManager
        self.kafka_eventstream.insert(*insert_args, **insert_kwargs)

        produce_args, produce_kwargs = list(self.kafka_eventstream.producer.produce.call_args)
        assert not produce_args
        assert produce_kwargs["topic"] == "events"
        assert produce_kwargs["key"] == six.text_type(self.project.id)

        version, type_, payload1, payload2 = json.loads(produce_kwargs["value"])
        assert version == 2
        assert type_ == "insert"

        # insert what would have been the Kafka payload directly
        # into Snuba, expect an HTTP 200 and for the event to now exist
        snuba_eventstream = SnubaEventStream()
        snuba_eventstream._send(self.project.id, "insert", (payload1, payload2))

    @patch("sentry.eventstream.insert")
    def test(self, mock_eventstream_insert):
        now = datetime.utcnow()

        event = self.__build_event(now)

        # verify eventstream was called by EventManager
        insert_args, insert_kwargs = list(mock_eventstream_insert.call_args)
        assert not insert_args
        assert insert_kwargs == {
            "event": event,
            "group": event.group,
            "is_new_group_environment": True,
            "is_new": True,
            "is_regression": False,
            "primary_hash": "acbd18db4cc2f85cedef654fccc4a4d8",
            "skip_consume": False,
            "received_timestamp": event.data["received"],
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

    @patch("sentry.eventstream.insert")
    def test_issueless(self, mock_eventstream_insert):
        now = datetime.utcnow()
        event = self.__build_event(now)

        event.group_id = None
        insert_args = ()
        insert_kwargs = {
            "event": event,
            "group": None,
            "is_new_group_environment": True,
            "is_new": True,
            "is_regression": False,
            "primary_hash": "acbd18db4cc2f85cedef654fccc4a4d8",
            "skip_consume": False,
            "received_timestamp": event.data["received"],
        }

        self.__produce_event(*insert_args, **insert_kwargs)
        result = snuba.raw_query(
            start=now - timedelta(days=1),
            end=now + timedelta(days=1),
            selected_columns=["event_id", "group_id"],
            groupby=None,
            filter_keys={"project_id": [self.project.id], "event_id": [event.event_id]},
        )
        assert len(result["data"]) == 1
        assert result["data"][0]["group_id"] is None
