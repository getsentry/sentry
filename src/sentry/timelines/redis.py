from __future__ import absolute_import

import functools
import itertools
import logging
import random
import time
from contextlib import contextmanager
from datetime import datetime

import pytz
from django.conf import settings
from rb import Cluster
from redis.client import Script
from redis.exceptions import (
    ResponseError,
    WatchError,
)


from .base import (
    Backend,
    Record,
)


logger = logging.getLogger('sentry.timelines')


ADD_TO_SCHEDULE_SCRIPT = """\
-- Ensures an timeline is scheduled to be digested.
-- KEYS: {WATING, READY}
-- ARGV: {TIMELINE, TIMESTAMP}

-- Check to see if the timeline exists in the "waiting" set (heuristics tell us
-- that this should be more likely than it's presence in the "ready" set.)
local waiting = redis.call('ZSCORE', KEYS[1], ARGV[1])

if waiting ~= false then
    -- If the item already exists, update the score if the provided timestamp
    -- is less than the current score.
    if tonumber(waiting) > tonumber(ARGV[2]) then
        redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])
    end
    return
end

-- Otherwise, check to see if the timeline already exists in the "ready" set.
-- If it doesn't, it needs to be added to the "waiting" set to be scheduled.
if redis.call('ZSCORE', KEYS[2], ARGV[1]) == false then
    redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])
    return
end
"""


TRUNCATE_TIMELINE_SCRIPT = """\
-- Trims a timeline to a maximum number of records.
-- Returns the number of keys that were deleted.
-- KEYS: {TIMELINE}
-- ARGV: {LIMIT}

local keys = redis.call('ZREVRANGE', KEYS[1], ARGV[1], -1)
for i, record in pairs(keys) do
    -- TODO: This could probably be optimized into single operations.
    redis.call('DEL', KEYS[1] .. ':r:' .. record)
    redis.call('ZREM', KEYS[1], record)
end
return table.getn(keys)
"""


# XXX: Passing `None` as the first argument is a dirty hack to allow us to use
# this more easily with the cluster
add_to_schedule = Script(None, ADD_TO_SCHEDULE_SCRIPT)
truncate_timeline = Script(None, TRUNCATE_TIMELINE_SCRIPT)


def to_timestamp(value):
    return (value - datetime(1970, 1, 1, tzinfo=pytz.utc)).total_seconds()


WAITING_STATE = 'w'
READY_STATE = 'r'


def make_schedule_key(namespace, state):
    return '{0}:s:{1}'.format(namespace, state)


def make_timeline_key(namespace, target):
    return '{0}:t:{1}'.format(namespace, target)


def make_iteration_key(timeline_key):
    return '{0}:i'.format(timeline_key)


def make_digest_key(timeline_key):
    return '{0}:d'.format(timeline_key)


def make_record_key(timeline_key, record):
    # XXX: Don't update this without updating the Lua script!
    # TODO: Just interpolate the hierarchical part here into the script.
    return '{0}:r:{1}'.format(timeline_key, record)


class RedisBackend(Backend):
    def __init__(self, **options):
        super(RedisBackend, self).__init__(**options)

        self.cluster = Cluster(**options.pop('cluster', settings.SENTRY_REDIS_OPTIONS))
        self.namespace = options.pop('namespace', 'digests')
        self.record_ttl = options.pop('record_ttl', 60 * 60)

        if options:
            logger.warning('Discarding invalid options: %r', options)

    def add(self, target, record):
        timeline_key = make_timeline_key(self.namespace, target)
        record_key = make_record_key(timeline_key, record.key)

        connection = self.cluster.get_local_client_for_key(timeline_key)
        with connection.pipeline() as pipeline:
            pipeline.multi()

            pipeline.set(
                record_key,
                self.codec.encode(record.value),
                ex=self.record_ttl,
            )

            pipeline.set(make_iteration_key(timeline_key), 0, nx=True)

            # TODO: Prefix the entry with the timestamp (lexicographically
            # sortable) to ensure that we can maintain abitrary precision:
            # http://redis.io/commands/ZADD#elements-with-the-same-score
            pipeline.zadd(timeline_key, record.timestamp, record.key)

            add_to_schedule(
                map(
                    functools.partial(make_schedule_key, self.namespace),
                    (WAITING_STATE, READY_STATE),
                ),
                (target, record.timestamp),
                pipeline,
            )

            should_truncate = random.random() < self.trim_chance
            if should_truncate:
                truncate_timeline((timeline_key,), (self.capacity,), pipeline)

            results = pipeline.execute()
            if should_truncate:
                logger.info('Removed %s extra records from %s.', results[-1], target)

    def schedule(self, cutoff, chunk=1000):
        """
        Moves timelines that are ready to be digested from the ``WAITING`` to
        the ``READY`` state.
        """
        # TODO: This doesn't lead to a fair balancing of workers, ideally each
        # scheduling task would be executed by a different process for each
        # host.
        for connection in itertools.imap(self.cluster.get_local_client, self.cluster.hosts):
            # TODO: Scheduling for each host should be protected by a lease.
            while True:
                items = connection.zrangebyscore(
                    make_schedule_key(self.namespace, WAITING_STATE),
                    min=0,
                    max=cutoff,
                    withscores=True,
                    start=0,
                    num=chunk,
                )

                # XXX: Redis will error if we try and execute an empty
                # transaction. If there are no items to move between states, we
                # need to exit the loop now. (This can happen on the first
                # iteration of the loop if there is nothing to do, or on a
                # subsequent iteration if there was exactly the same number of
                # items to change states as the chunk size.)
                if not items:
                    break

                with connection.pipeline() as pipeline:
                    pipeline.multi()

                    pipeline.zrem(
                        make_schedule_key(self.namespace, WAITING_STATE),
                        *[key for key, timestamp in items]
                    )

                    pipeline.zadd(
                        make_schedule_key(self.namespace, READY_STATE),
                        *itertools.chain.from_iterable([(timestamp, key) for (key, timestamp) in items])
                    )

                    yield items

                    pipeline.execute()

                # If we retrieved less than the chunk size of items, we don't
                # need try to retrieve more items.
                if len(items) < chunk:
                    break

    def maintenance(self, timeout):
        raise NotImplementedError

    @contextmanager
    def digest(self, target):
        timeline_key = make_timeline_key(self.namespace, target)
        digest_key = make_digest_key(timeline_key)

        # TODO: Need to wrap this whole section in a lease to try and avoid data races.
        connection = self.cluster.get_local_client_for_key(timeline_key)

        if connection.zscore(make_schedule_key(self.namespace, READY_STATE), target) is None:
            raise Exception('Cannot digest timeline, timeline is not in the ready state.')

        with connection.pipeline() as pipeline:
            pipeline.watch(digest_key)  # This shouldn't be necessary, but better safe than sorry?

            if pipeline.exists(digest_key):
                pipeline.multi()
                pipeline.zunionstore(digest_key, (timeline_key, digest_key), aggregate='max')
            else:
                pipeline.multi()
                pipeline.rename(timeline_key, digest_key)
                try:
                    pipeline.execute()
                except ResponseError as error:
                    if 'no such key' in str(error):
                        logger.debug('Could not move timeline for digestion (likely has no contents.)')
                    else:
                        raise

        # XXX: This must select all records, even though not all of them will
        # be returned if they exceed the capacity, to ensure that all records
        # will be garbage collected.
        records = connection.zrevrange(digest_key, 0, -1, withscores=True)
        if not records:
            logger.info('Retrieved timeline containing no records.')

        def get_iteration_count(default=0):
            value = connection.get(make_iteration_key(timeline_key))
            if not value:
                logger.warning('Could not retrieve iteration counter for %s, defaulting to %s.', target, default)
                return default
            return int(value)

        iteration = get_iteration_count()

        def get_records_for_digest():
            with connection.pipeline(transaction=False) as pipeline:
                for key, timestamp in records:
                    pipeline.get(make_record_key(timeline_key, key))

                for (key, timestamp), value in zip(records, pipeline.execute()):
                    # We have to handle failures if the key does not exist --
                    # this could happen due to evictions or race conditions
                    # where the record was added to a timeline while it was
                    # already being digested.
                    if value is None:
                        logger.warning('Could not retrieve event for timeline.')
                    else:
                        yield Record(key, self.codec.decode(value), timestamp)

        yield itertools.islice(get_records_for_digest(), self.capacity)

        def reschedule():
            with connection.pipeline() as pipeline:
                pipeline.watch(digest_key)  # This shouldn't be necessary, but better safe than sorry?
                pipeline.multi()

                record_keys = [make_record_key(timeline_key, key) for key, score in records]
                pipeline.delete(digest_key, *record_keys)
                pipeline.zrem(make_schedule_key(self.namespace, READY_STATE), target)
                pipeline.zadd(make_schedule_key(self.namespace, WAITING_STATE), time.time() + self.backoff(iteration + 1), target)
                pipeline.set(make_iteration_key(timeline_key), iteration + 1)
                pipeline.execute()

        def unschedule():
            with connection.pipeline() as pipeline:
                # Watch the timeline to ensure that no other transactions add
                # events to the timeline while we are trying to delete it.
                pipeline.watch(timeline_key)
                pipeline.multi()
                if connection.zcard(timeline_key) is 0:
                    pipeline.delete(make_iteration_key(timeline_key))
                    pipeline.zrem(make_schedule_key(self.namespace, READY_STATE), target)
                    pipeline.zrem(make_schedule_key(self.namespace, WAITING_STATE), target)
                    pipeline.execute()

        # If there were records in the digest, we need to schedule it so that
        # we schedule any records that were added during digestion with the
        # appropriate backoff. If there were no items, we can try to remove the
        # timeline from the digestion schedule.
        if records:
            reschedule()
        else:
            try:
                unschedule()
            except WatchError:
                logger.debug('Could not remove timeline from schedule, rescheduling instead')
                reschedule()
