import functools
import itertools
import mock
from datetime import datetime

import pytz
from exam import fixture

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
    defaults = {
        'cluster': {
            'hosts': {
                0: {'db': 9},
            },
        },
    }

    @fixture
    def records(self):
        for i in itertools.count():
            yield Record(i, i, i)

    def get_backend(self, options={}):
        kwargs = self.defaults.copy()
        kwargs.update(options)
        return RedisBackend(**kwargs)

    def test_add_record(self):
        timeline = 'timeline'
        backend = self.get_backend()

        timeline_key = make_timeline_key(backend.namespace, timeline)
        connection = backend.cluster.get_local_client_for_key(timeline_key)

        record = next(self.records)
        waiting_set_key = make_schedule_key(backend.namespace, SCHEDULE_STATE_WAITING)
        record_key = make_record_key(timeline_key, record.key)

        get_timeline_score_in_waiting_set = functools.partial(connection.zscore, waiting_set_key, timeline)
        get_timeline_iteration_counter = functools.partial(connection.get, make_iteration_key(timeline_key))
        get_record_score_in_timeline_set = functools.partial(connection.zscore, timeline_key, record.key)

        def get_record_value():
            value = connection.get(record_key)
            return backend.codec.decode(value) if value is not None else None

        with self.assertChanges(get_timeline_score_in_waiting_set, before=None, after=record.timestamp), \
                self.assertChanges(get_timeline_iteration_counter, before=None, after='0'), \
                self.assertChanges(get_record_score_in_timeline_set, before=None, after=record.timestamp), \
                self.assertChanges(get_record_value, before=None, after=record.value):
            backend.add(timeline, record)

    def test_truncation(self):
        timeline = 'timeline'
        capacity = 5
        backend = self.get_backend({
            'capacity': capacity,
            'truncation_chance': 0.5,
        })

        timeline_key = make_timeline_key(backend.namespace, timeline)
        connection = backend.cluster.get_local_client_for_key(timeline_key)

        get_timeline_size = functools.partial(connection.zcard, timeline_key)

        fill = 10

        with mock.patch('random.random', return_value=1.0):
            with self.assertChanges(get_timeline_size, before=0, after=fill):
                for _ in xrange(fill):
                    backend.add(timeline, next(self.records))

        with mock.patch('random.random', return_value=0.0):
            with self.assertChanges(get_timeline_size, before=fill, after=capacity):
                backend.add(timeline, next(self.records))
