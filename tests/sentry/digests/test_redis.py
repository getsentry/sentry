import functools
from datetime import datetime

import pytz

from sentry.digests.base import (
    Record,
)
from sentry.digests.redis import (
    SCHEDULE_STATE_WAITING,
    RedisBackend,
    make_iteration_key,
    make_timeline_key,
    make_schedule_key,
    make_record_key,
)
from sentry.testutils import TestCase


def to_timestamp(value):
    return (value - datetime(1970, 1, 1, tzinfo=pytz.utc)).total_seconds()


class RedisBackendTestCase(TestCase):
    def setUp(self):
        self.backend = RedisBackend(
            cluster={
                'hosts': {
                    0: {'db': 9},
                },
            },
        )

    def test_add_record(self):
        record = Record('00000000000010008080808080808080', 'value', 0)
        timeline = 'timeline'

        timeline_key = make_timeline_key(self.backend.namespace, timeline)
        connection = self.backend.cluster.get_local_client_for_key(timeline_key)

        waiting_set_key = make_schedule_key(self.backend.namespace, SCHEDULE_STATE_WAITING)
        record_key = make_record_key(timeline_key, record.key)

        get_timeline_score_in_waiting_set = functools.partial(connection.zscore, waiting_set_key, timeline)
        get_timeline_iteration_counter = functools.partial(connection.get, make_iteration_key(timeline_key))
        get_record_score_in_timeline_set = functools.partial(connection.zscore, timeline_key, record.key)

        def get_record_value():
            value = connection.get(record_key)
            return self.backend.codec.decode(value) if value is not None else None

        with self.assertChanges(get_timeline_score_in_waiting_set, before=None, after=record.timestamp), \
                self.assertChanges(get_timeline_iteration_counter, before=None, after='0'), \
                self.assertChanges(get_record_score_in_timeline_set, before=None, after=record.timestamp), \
                self.assertChanges(get_record_value, before=None, after=record.value):
            self.backend.add(timeline, record)
