from __future__ import absolute_import

import functools
import itertools
import mock
import six
import time

from exam import fixture

from sentry.digests import (
    Record,
)
from sentry.digests.backends.redis import (
    SCHEDULE_STATE_READY,
    SCHEDULE_STATE_WAITING,
    RedisBackend,
    ensure_timeline_scheduled,
    make_digest_key,
    make_last_processed_timestamp_key,
    make_record_key,
    make_schedule_key,
    make_timeline_key,
    truncate_timeline,
)
from sentry.utils.redis import clusters
from sentry.testutils import TestCase


def get_set_size(cluster, key):
    results = []
    with cluster.all() as client:
        results = client.zcard(key)
    return sum(results.value.values())


class BaseRedisBackendTestCase(TestCase):
    @fixture
    def records(self):
        for i in itertools.count():
            yield Record(six.text_type(i), six.text_type(i), float(i))


class RedisScriptTestCase(BaseRedisBackendTestCase):
    def test_ensure_timeline_scheduled_script(self):
        cluster = clusters.get('default')
        client = cluster.get_local_client(six.next(iter(cluster.hosts)))

        timeline = 'timeline'
        timestamp = 100.0

        waiting_set_size = functools.partial(client.zcard, 'waiting')
        ready_set_size = functools.partial(client.zcard, 'ready')

        timeline_score_in_waiting_set = functools.partial(client.zscore, 'waiting', timeline)
        timeline_score_in_ready_set = functools.partial(client.zscore, 'ready', timeline)

        keys = ('waiting', 'ready', 'last-processed')

        # The first addition should cause the timeline to be added to the ready set.
        with self.assertChanges(ready_set_size, before=0, after=1), \
                self.assertChanges(timeline_score_in_ready_set, before=None, after=timestamp):
            assert ensure_timeline_scheduled(client, keys, (timeline, timestamp, 1, 10)) == 1

        # Adding it again with a timestamp in the future should not change the schedule time.
        with self.assertDoesNotChange(waiting_set_size), \
                self.assertDoesNotChange(ready_set_size), \
                self.assertDoesNotChange(timeline_score_in_ready_set):
            assert ensure_timeline_scheduled(client, keys, (timeline, timestamp + 50, 1, 10)) is None

        # Move the timeline from the ready set to the waiting set.
        client.zrem('ready', timeline)
        client.zadd('waiting', timestamp, timeline)
        client.set('last-processed', timestamp)

        increment = 1
        with self.assertDoesNotChange(waiting_set_size), \
                self.assertChanges(timeline_score_in_waiting_set, before=timestamp, after=timestamp + increment):
            assert ensure_timeline_scheduled(client, keys, (timeline, timestamp, increment, 10)) is None

        # Make sure the schedule respects the maximum value.
        with self.assertDoesNotChange(waiting_set_size), \
                self.assertChanges(timeline_score_in_waiting_set, before=timestamp + 1, after=timestamp):
            assert ensure_timeline_scheduled(client, keys, (timeline, timestamp, increment, 0)) is None

        # Test to ensure a missing last processed timestamp can be handled
        # correctly (chooses minimum of schedule value and record timestamp.)
        client.zadd('waiting', timestamp, timeline)
        client.delete('last-processed')
        with self.assertDoesNotChange(waiting_set_size), \
                self.assertDoesNotChange(timeline_score_in_waiting_set):
            assert ensure_timeline_scheduled(client, keys, (timeline, timestamp + 100, increment, 10)) is None

        with self.assertDoesNotChange(waiting_set_size), \
                self.assertChanges(timeline_score_in_waiting_set, before=timestamp, after=timestamp - 100):
            assert ensure_timeline_scheduled(client, keys, (timeline, timestamp - 100, increment, 10)) is None

    def test_truncate_timeline_script(self):
        cluster = clusters.get('default')
        client = cluster.get_local_client(six.next(iter(cluster.hosts)))

        timeline = 'timeline'

        # Preload some fake records (the contents don't matter.)
        records = list(itertools.islice(self.records, 10))
        for record in records:
            client.zadd(timeline, record.timestamp, record.key)
            client.set(make_record_key(timeline, record.key), 'data')

        with self.assertChanges(lambda: client.zcard(timeline), before=10, after=5):
            truncate_timeline(client, (timeline,), (5, timeline))

            # Ensure the early records don't exist.
            for record in records[:5]:
                assert not client.zscore(timeline, record.key)
                assert not client.exists(make_record_key(timeline, record.key))

            # Ensure the later records do exist.
            for record in records[-5:]:
                assert client.zscore(timeline, record.key) == float(record.timestamp)
                assert client.exists(make_record_key(timeline, record.key))


class RedisBackendTestCase(BaseRedisBackendTestCase):
    def test_add_record(self):
        timeline = 'timeline'
        backend = RedisBackend()

        timeline_key = make_timeline_key(backend.namespace, timeline)
        connection = backend.cluster.get_local_client_for_key(timeline_key)

        record = next(self.records)
        ready_set_key = make_schedule_key(backend.namespace, SCHEDULE_STATE_READY)
        record_key = make_record_key(timeline_key, record.key)

        get_timeline_score_in_ready_set = functools.partial(connection.zscore, ready_set_key, timeline)
        get_record_score_in_timeline_set = functools.partial(connection.zscore, timeline_key, record.key)

        def get_record_value():
            value = connection.get(record_key)
            return backend.codec.decode(value) if value is not None else None

        with self.assertChanges(get_timeline_score_in_ready_set, before=None, after=record.timestamp), \
                self.assertChanges(get_record_score_in_timeline_set, before=None, after=record.timestamp), \
                self.assertChanges(get_record_value, before=None, after=record.value):
            backend.add(timeline, record)

    def test_truncation(self):
        timeline = 'timeline'
        capacity = 5
        backend = RedisBackend(capacity=capacity, truncation_chance=0.5)

        timeline_key = make_timeline_key(backend.namespace, timeline)
        connection = backend.cluster.get_local_client_for_key(timeline_key)

        get_timeline_size = functools.partial(connection.zcard, timeline_key)

        fill = 10

        with mock.patch('random.random', return_value=1.0):
            with self.assertChanges(get_timeline_size, before=0, after=fill):
                for _ in range(fill):
                    backend.add(timeline, next(self.records))

        with mock.patch('random.random', return_value=0.0):
            with self.assertChanges(get_timeline_size, before=fill, after=capacity):
                backend.add(timeline, next(self.records))

    def test_scheduling(self):
        backend = RedisBackend()

        waiting_set_key = make_schedule_key(backend.namespace, SCHEDULE_STATE_WAITING)
        ready_set_key = make_schedule_key(backend.namespace, SCHEDULE_STATE_READY)

        n = 10

        for i in range(n):
            with backend.cluster.map() as client:
                client.zadd(waiting_set_key, i, 'timelines:{0}'.format(i))

        for i in range(n, n * 2):
            with backend.cluster.map() as client:
                client.zadd(ready_set_key, i, 'timelines:{0}'.format(i))

        get_waiting_set_size = functools.partial(get_set_size, backend.cluster, waiting_set_key)
        get_ready_set_size = functools.partial(get_set_size, backend.cluster, ready_set_key)

        with self.assertChanges(get_waiting_set_size, before=n, after=0), \
                self.assertChanges(get_ready_set_size, before=n, after=n * 2):
            results = zip(range(n), list(backend.schedule(n, chunk=5)))
            assert len(results) is n

            # Ensure scheduled entries are returned earliest first.
            for i, entry in results:
                assert entry.key == 'timelines:{0}'.format(i)
                assert entry.timestamp == float(i)

    def test_maintenance(self):
        timeline = 'timeline'
        backend = RedisBackend(ttl=3600)

        timeline_key = make_timeline_key(backend.namespace, timeline)
        digest_key = make_digest_key(timeline_key)
        waiting_set_key = make_schedule_key(backend.namespace, SCHEDULE_STATE_WAITING)
        ready_set_key = make_schedule_key(backend.namespace, SCHEDULE_STATE_READY)

        now = time.time()

        connection = backend.cluster.get_local_client_for_key(timeline_key)
        schedule_time = now - 60
        connection.zadd(ready_set_key, schedule_time, timeline)
        connection.zadd(timeline_key, 0, '1')
        connection.set(make_record_key(timeline_key, '1'), 'data')
        connection.zadd(digest_key, 0, '2')
        connection.set(make_record_key(timeline_key, '2'), 'data')

        # Move the digest from the ready set to the waiting set.
        backend.maintenance(now)
        assert connection.zcard(ready_set_key) == 0
        assert connection.zrange(waiting_set_key, 0, -1, withscores=True) == [(timeline, schedule_time)]

        connection.zrem(waiting_set_key, timeline)
        connection.zadd(ready_set_key, schedule_time, timeline)

        # Delete the digest from the ready set.
        with mock.patch('time.time', return_value=now + (backend.ttl + 1)):
            backend.maintenance(now)

        keys = (
            ready_set_key,
            waiting_set_key,
            timeline_key,
            digest_key,
            make_record_key(timeline_key, '1'),
            make_record_key(timeline_key, '2'),
        )
        for key in keys:
            assert connection.exists(key) is False

    def test_delete(self):
        timeline = 'timeline'
        backend = RedisBackend()

        timeline_key = make_timeline_key(backend.namespace, timeline)
        digest_key = make_digest_key(timeline_key)
        waiting_set_key = make_schedule_key(backend.namespace, SCHEDULE_STATE_WAITING)
        ready_set_key = make_schedule_key(backend.namespace, SCHEDULE_STATE_READY)

        connection = backend.cluster.get_local_client_for_key(timeline_key)
        connection.zadd(waiting_set_key, 0, timeline)
        connection.zadd(ready_set_key, 0, timeline)
        connection.zadd(timeline_key, 0, '1')
        connection.set(make_record_key(timeline_key, '1'), 'data')
        connection.zadd(digest_key, 0, '2')
        connection.set(make_record_key(timeline_key, '2'), 'data')

        keys = (
            waiting_set_key,
            ready_set_key,
            digest_key,
            timeline_key,
            make_record_key(timeline_key, '1'),
            make_record_key(timeline_key, '2')
        )

        def check_keys_exist():
            return map(connection.exists, keys)

        with self.assertChanges(check_keys_exist, before=[True] * len(keys), after=[False] * len(keys)):
            backend.delete(timeline)


class ExpectedError(Exception):
    pass


class DigestTestCase(BaseRedisBackendTestCase):
    def test_digesting(self):
        backend = RedisBackend()

        # XXX: This assumes the that adding records and scheduling are working
        # correctly to set up the state needed for this test!

        timeline = 'timeline'
        n = 10
        records = list(itertools.islice(self.records, n))
        for record in records:
            backend.add(timeline, record)

        for entry in backend.schedule(time.time()):
            pass

        timeline_key = make_timeline_key(backend.namespace, timeline)
        client = backend.cluster.get_local_client_for_key(timeline_key)

        waiting_set_key = make_schedule_key(backend.namespace, SCHEDULE_STATE_WAITING)
        ready_set_key = make_schedule_key(backend.namespace, SCHEDULE_STATE_READY)

        get_timeline_size = functools.partial(client.zcard, timeline_key)
        get_waiting_set_size = functools.partial(get_set_size, backend.cluster, waiting_set_key)
        get_ready_set_size = functools.partial(get_set_size, backend.cluster, ready_set_key)

        with self.assertChanges(get_timeline_size, before=n, after=0), \
                self.assertChanges(get_waiting_set_size, before=0, after=1), \
                self.assertChanges(get_ready_set_size, before=1, after=0):

            timestamp = time.time()
            with mock.patch('time.time', return_value=timestamp), \
                    backend.digest(timeline) as entries:
                entries = list(entries)
                assert entries == records[::-1]

            next_scheduled_delivery = timestamp + backend.minimum_delay
            assert client.zscore(waiting_set_key, timeline) == next_scheduled_delivery
            assert int(client.get(make_last_processed_timestamp_key(timeline_key))) == int(timestamp)

        # Move the timeline back to the ready set.
        for entry in backend.schedule(next_scheduled_delivery):
            pass

        # The digest should be removed from the schedule if it is empty.
        with self.assertDoesNotChange(get_waiting_set_size), \
                self.assertChanges(get_ready_set_size, before=1, after=0):
            with backend.digest(timeline) as entries:
                assert list(entries) == []

        assert client.get(make_last_processed_timestamp_key(timeline_key)) is None

    def test_digesting_failure_recovery(self):
        backend = RedisBackend()

        # XXX: This assumes the that adding records and scheduling are working
        # correctly to set up the state needed for this test!

        timeline = 'timeline'
        n = 10
        records = list(itertools.islice(self.records, n))
        for record in records:
            backend.add(timeline, record)

        for entry in backend.schedule(time.time()):
            pass

        timeline_key = make_timeline_key(backend.namespace, timeline)
        client = backend.cluster.get_local_client_for_key(timeline_key)

        waiting_set_key = make_schedule_key(backend.namespace, SCHEDULE_STATE_WAITING)
        ready_set_key = make_schedule_key(backend.namespace, SCHEDULE_STATE_READY)

        get_waiting_set_size = functools.partial(get_set_size, backend.cluster, waiting_set_key)
        get_ready_set_size = functools.partial(get_set_size, backend.cluster, ready_set_key)
        get_timeline_size = functools.partial(client.zcard, timeline_key)
        get_digest_size = functools.partial(client.zcard, make_digest_key(timeline_key))

        with self.assertChanges(get_timeline_size, before=n, after=0), \
                self.assertChanges(get_digest_size, before=0, after=n), \
                self.assertDoesNotChange(get_waiting_set_size), \
                self.assertDoesNotChange(get_ready_set_size):
            try:
                with backend.digest(timeline) as entries:
                    raise ExpectedError
            except ExpectedError:
                pass

        # Add another few records to the timeline to ensure they end up in the digest.
        extra = list(itertools.islice(self.records, 5))
        for record in extra:
            backend.add(timeline, record)

        with self.assertChanges(get_timeline_size, before=len(extra), after=0), \
                self.assertChanges(get_digest_size, before=len(records), after=0), \
                self.assertChanges(get_waiting_set_size, before=0, after=1), \
                self.assertChanges(get_ready_set_size, before=1, after=0):
            timestamp = time.time()
            with mock.patch('time.time', return_value=timestamp), \
                    backend.digest(timeline) as entries:
                entries = list(entries)
                assert entries == (records + extra)[::-1]

            assert client.zscore(waiting_set_key, timeline) == timestamp + backend.minimum_delay
