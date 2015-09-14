from __future__ import absolute_import

import functools
import itertools
import logging
import time
import zlib
from collections import namedtuple
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

from sentry.utils.compat import pickle

from .base import Backend


logger = logging.getLogger(__name__)


Record = namedtuple('Record', 'key value timestamp')

WAITING_STATE = 'waiting'
READY_STATE = 'ready'


ADD_TO_SCHEDULE_SCRIPT = """\
-- Ensures an timeline is scheduled to be digested.
-- KEYS: {WATING, READY}
-- ARGV: {TIMELINE, TIMESTAMP}

-- Check to see if the timeline already exists in the "ready" set.
if redis.call('ZSCORE', KEYS[2], ARGV[1]) then return end

-- Otherwise, add the timeline to the "waiting" set, using the lower of the two
-- timestamps if the timeline already exists in the schedule.
local score = redis.call('ZSCORE', KEYS[1], ARGV[1])
if score == false or tonumber(score) > tonumber(ARGV[2]) then
    redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])
end
"""

# XXX: Passing `None` as the first argument is a dirty hack to allow us to use
# this more easily with the cluster
add_to_schedule = Script(None, ADD_TO_SCHEDULE_SCRIPT)


def to_timestamp(value):
    return (value - datetime(1970, 1, 1, tzinfo=pytz.utc)).total_seconds()


class CompressedPickleCodec(object):
    def encode(self, value):
        return zlib.compress(pickle.dumps(value))

    def decode(self, value):
        return pickle.loads(zlib.decompress(value))


class RedisBackend(Backend):
    def __init__(self, **options):
        if not options:
            options = settings.SENTRY_REDIS_OPTIONS

        # TODO: Allow setting an instance prefix, and prepend all keys.
        self.cluster = Cluster(options['hosts'])

        # TODO: Allow this to be configured (probably via a import path.)
        self.codec = CompressedPickleCodec()

        self.interval = 60 * 5

    def make_key(self, timeline, record):
        # TODO: Can use a shorter key here.
        return '{timeline}/records/{record}'.format(timeline=timeline, record=record)

    def add(self, timeline, record):
        connection = self.cluster.get_local_client_for_key(timeline)
        with connection.pipeline() as pipeline:
            pipeline.multi()
            # TODO: This actually should be SETEX, but need to figure out what the
            # correct TTL would be, based on scheduling, etc.
            # TODO: Prefix the entry with the timestamp (lexicographically
            # sortable) to ensure that we can maintain abitrary precision:
            # http://redis.io/commands/ZADD#elements-with-the-same-score
            pipeline.set(self.make_key(timeline, record.key), self.codec.encode(record.value))
            pipeline.zadd(timeline, record.timestamp, record.key)
            add_to_schedule((WAITING_STATE, READY_STATE), (timeline, record.timestamp), pipeline)
            # TODO: Trim the timeline if it is over the defined capacity.
            pipeline.execute()

    def schedule(self, cutoff, chunk=1000):
        # TODO: This doesn't lead to a fair balancing of workers, ideally each
        # scheduling task would be executed by a different process for each
        # host.
        for connection in itertools.imap(self.cluster.get_local_client, self.cluster.hosts):
            get_remaining_items = functools.partial(connection.zrangebyscore, WAITING_STATE, 0, cutoff, withscores=True, start=0, num=chunk)

            items = get_remaining_items()
            while items:
                with connection.pipeline() as pipeline:
                    pipeline.multi()
                    # TODO: It would be marginally more efficient to just
                    # execute two commands with all of the keys, since we
                    # already have them in memory.
                    for key, timestamp in items:
                        pipeline.zrem(WAITING_STATE, key)
                        pipeline.zadd(READY_STATE, timestamp, key)
                    yield items
                    pipeline.execute()

                items = get_remaining_items()

    def maintenance(self, timeout):
        raise NotImplementedError

    @contextmanager
    def digest(self, timeline):
        connection = self.cluster.get_local_client_for_key(timeline)

        # TODO: Need to wrap this whole section in a lease to try and avoid data races.

        # TODO: Can use a shorter key here.
        digest_key = '{timeline}/digest'.format(timeline=timeline)

        with connection.pipeline() as pipeline:
            pipeline.watch(digest_key)  # This shouldn't be necessary, but better safe than sorry?
            if pipeline.exists(digest_key):
                pipeline.multi()
                pipeline.zunionstore(digest_key, (timeline, digest_key), aggregate='max')
            else:
                pipeline.multi()
                pipeline.rename(timeline, digest_key)
                try:
                    pipeline.execute()
                except ResponseError as error:
                    # TODO: This means that there are actually no contents in
                    # the original timeline -- we should be able to ignore this
                    # error, but it would be nice to be more specific.
                    logger.debug('Could not move timeline for digestion (likely has no contents.)')

        # TODO: It might make sense to put a limit on this (corresponding to
        # the timeline "capacity".)
        records = connection.zrevrange(digest_key, 0, -1, withscores=True)

        def get_records_for_digest():
            with connection.pipeline(transaction=False) as pipeline:
                for key, timestamp in records:
                    pipeline.get(self.make_key(timeline, key))

                for (key, timestamp), value in zip(records, pipeline.execute()):
                    # We have to handle failures if the key does not exist --
                    # this could happen due to evictions or race conditions
                    # where the record was added to a timeline while it was
                    # already being digested.
                    if value is None:
                        logger.warning('Could not retrieve event for timeline.')
                    else:
                        # TODO: Could make this lazy, but that might be unnecessary complexity.
                        yield Record(key, self.codec.decode(value), timestamp)

        yield get_records_for_digest()

        def reschedule():
            with connection.pipeline() as pipeline:
                pipeline.watch(digest_key)  # This shouldn't be necessary, but better safe than sorry?
                pipeline.multi()
                pipeline.delete(digest_key)
                for key, score in records:
                    pipeline.delete(self.make_key(timeline, key))
                pipeline.zrem(READY_STATE, timeline)
                pipeline.zadd(WAITING_STATE, time.time() + self.interval, timeline)  # TODO: Better interval?
                pipeline.execute()

        def unschedule():
            with connection.pipeline() as pipeline:
                # Watch the timeline to ensure that no other transactions add
                # events to the timeline while we are trying to delete it.
                pipeline.watch(timeline)
                pipeline.multi()
                if connection.zcard(timeline) is 0:
                    pipeline.zrem(READY_STATE, timeline)
                    pipeline.zrem(WAITING_STATE, timeline)
                    # TODO: This needs to observe failures, and reschedule as
                    # normal if the transaction fails due to a watch.
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
                logger.debug('Could not remove timeline from schedule, rescheduling instead.')
                reschedule()
