import functools
import itertools
import mock
from datetime import datetime

import pytz
from exam import fixture
from redis.client import StrictRedis

from sentry.digests.base import (
    Record,
)
from sentry.digests.redis import (
    SCHEDULE_STATE_WAITING,
    RedisBackend,
    add_to_schedule,
    make_iteration_key,
    make_record_key,
    make_schedule_key,
    make_timeline_key,
    truncate_timeline,
)
from sentry.testutils import TestCase


def to_timestamp(value):
    return (value - datetime(1970, 1, 1, tzinfo=pytz.utc)).total_seconds()


class RedisScriptTestCase(TestCase):
    @fixture
    def records(self):
        for i in itertools.count():
            yield Record(i, i, i)

    def test_add_to_schedule_script(self):
        client = StrictRedis(db=9)

        timeline = 'timeline'
        timestamp = 100.0

        waiting_set_size = functools.partial(client.zcard, 'waiting')
        ready_set_size = functools.partial(client.zcard, 'ready')
        timeline_score_in_waiting_set = functools.partial(client.zscore, 'waiting', timeline)
        timeline_score_in_ready_set = functools.partial(client.zscore, 'ready', timeline)

        # The first addition should cause the timeline to be added to the waiting set.
        with self.assertChanges(waiting_set_size, before=0, after=1), \
                self.assertChanges(timeline_score_in_waiting_set, before=None, after=timestamp):
            add_to_schedule(('waiting', 'ready'), (timeline, timestamp), client)

        # Adding it again with a timestamp in the future should not change the schedule time.
        with self.assertDoesNotChange(waiting_set_size), \
                self.assertDoesNotChange(timeline_score_in_waiting_set):
            add_to_schedule(('waiting', 'ready'), (timeline, timestamp + 50), client)

        # If we see a record with a timestamp earlier than the schedule time,
        # we should change the schedule.
        with self.assertDoesNotChange(waiting_set_size), \
                self.assertChanges(timeline_score_in_waiting_set, before=timestamp, after=timestamp - 50):
            add_to_schedule(('waiting', 'ready'), (timeline, timestamp - 50), client)

        # Move the timeline from the waiting set to the ready set.
        client.zrem('waiting', timeline)
        client.zadd('ready', timestamp, timeline)

        # Nothing should change.
        with self.assertDoesNotChange(waiting_set_size), \
                self.assertDoesNotChange(ready_set_size), \
                self.assertDoesNotChange(timeline_score_in_ready_set):
            add_to_schedule(('waiting', 'ready'), (timeline, timestamp - 50), client)

    def test_truncate_timeline_script(self):
        client = StrictRedis(db=9)

        timeline = 'timeline'

        # Preload some fake records (the contents don't matter.)
        records = list(itertools.islice(self.records, 10))
        for record in records:
            client.zadd(timeline, record.timestamp, record.key)
            client.set(make_record_key(timeline, record.key), 'data')

        with self.assertChanges(lambda: client.zcard(timeline), before=10, after=5):
            truncate_timeline((timeline,), (5,), client)

            # Ensure the early records don't exist.
            for record in records[:5]:
                assert not client.zscore(timeline, record.key)
                assert not client.exists(make_record_key(timeline, record.key))

            # Ensure the later records do exist.
            for record in records[-5:]:
                assert client.zscore(timeline, record.key) == float(record.timestamp)
                assert client.exists(make_record_key(timeline, record.key))


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
