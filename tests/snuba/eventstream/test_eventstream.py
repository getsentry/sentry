from __future__ import absolute_import

from datetime import datetime, timedelta
import six
import time
import logging
from mock import patch, Mock

from sentry.event_manager import EventManager
from sentry.eventstream.kafka import KafkaEventStream
from sentry.testutils import SnubaTestCase
from sentry.utils import snuba, json


class SnubaEventStreamTest(SnubaTestCase):
    def setUp(self):
        super(SnubaEventStreamTest, self).setUp()

        self.kafka_eventstream = KafkaEventStream()
        self.kafka_eventstream.producer = Mock()

    @patch('sentry.eventstream.insert')
    @patch('sentry.tagstore.delay_index_event_tags')
    def test(self, mock_delay_index_event_tags, mock_eventstream_insert):
        now = datetime.utcnow()

        def _get_event_count():
            return snuba.query(
                start=now - timedelta(days=1),
                end=now + timedelta(days=1),
                groupby=['project_id'],
                filter_keys={'project_id': [self.project.id]},
            ).get(self.project.id, 0)

        assert _get_event_count() == 0

        raw_event = {
            'event_id': 'a' * 32,
            'message': 'foo',
            'timestamp': time.mktime(now.timetuple()),
            'level': logging.ERROR,
            'logger': 'default',
            'tags': [],
        }

        manager = EventManager(raw_event)
        manager.normalize()
        event = manager.save(self.project.id)

        # verify eventstream was called by EventManager
        insert_args, insert_kwargs = list(mock_eventstream_insert.call_args)
        assert not insert_args
        assert insert_kwargs == {
            'event': event,
            'group': event.group,
            'is_new_group_environment': True,
            'is_new': True,
            'is_regression': False,
            'is_sample': False,
            'primary_hash': 'acbd18db4cc2f85cedef654fccc4a4d8',
            'skip_consume': False
        }

        assert mock_delay_index_event_tags.call_count == 1

        # pass arguments on to Kafka EventManager
        self.kafka_eventstream.insert(*insert_args, **insert_kwargs)

        produce_args, produce_kwargs = list(self.kafka_eventstream.producer.produce.call_args)
        assert not produce_args
        assert produce_kwargs['topic'] == 'events'
        assert produce_kwargs['key'] == six.text_type(self.project.id)

        version, type_, primary_payload = json.loads(produce_kwargs['value'])[:3]
        assert version == 2
        assert type_ == 'insert'

        # insert what would have been the Kafka payload directly
        # into Snuba, expect an HTTP 200 and for the event to now exist
        snuba.insert_raw([primary_payload])
        assert _get_event_count() == 1
