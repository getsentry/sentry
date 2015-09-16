from __future__ import absolute_import

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


WAITING_STATE = 'w'
READY_STATE = 'r'


def make_schedule_key(state):
    return 's:{0}'.format(state)


def make_timeline_key(timeline):
    return 't:{0}'.format(timeline)


def make_digest_key(timeline):
    return '{0}:d'.format(make_timeline_key(timeline))


def make_record_key(timeline, record):
    return '{0}:r:{1}'.format(make_timeline_key(timeline), record)


class RedisBackend(Backend):
    def __init__(self, **options):
        if not options:
            options = settings.SENTRY_REDIS_OPTIONS

        self.cluster = Cluster(options['hosts'])

        # TODO: Make this configurable.
        self.prefix = 'digests'

        # TODO: Allow this to be configured (probably via a import path.)
        self.codec = CompressedPickleCodec()

        self.interval = 60 * 5

    def prefix_key(self, key):
        return '{0}:{1}'.format(self.prefix, key)

    def add(self, timeline, record):
        timeline_key = self.prefix_key(make_timeline_key(timeline))
        record_key = self.prefix_key(make_record_key(timeline, record.key))

        connection = self.cluster.get_local_client_for_key(timeline_key)
        with connection.pipeline() as pipeline:
            pipeline.multi()

            # TODO: This actually should be SETEX, but need to figure out what the
            # correct TTL would be, based on scheduling, etc.
            pipeline.set(record_key, self.codec.encode(record.value))

            # TODO: Prefix the entry with the timestamp (lexicographically
            # sortable) to ensure that we can maintain abitrary precision:
            # http://redis.io/commands/ZADD#elements-with-the-same-score
            pipeline.zadd(timeline_key, record.timestamp, record.key)

            add_to_schedule(
                map(self.prefix_key, map(make_schedule_key, (WAITING_STATE, READY_STATE))),
                (timeline, record.timestamp),
                pipeline,
            )

            # TODO: Trim the timeline if it is over the defined capacity.
            pipeline.execute()

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
                    self.prefix_key(make_schedule_key(WAITING_STATE)),
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
                        self.prefix_key(make_schedule_key(WAITING_STATE)),
                        *[key for key, timestamp in items]
                    )

                    pipeline.zadd(
                        self.prefix_key(make_schedule_key(READY_STATE)),
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
    def digest(self, timeline):
        timeline_key = self.prefix_key(make_timeline_key(timeline))
        digest_key = self.prefix_key(make_digest_key(timeline))

        # TODO: Need to wrap this whole section in a lease to try and avoid data races.
        connection = self.cluster.get_local_client_for_key(timeline_key)

        if connection.zscore(self.prefix_key(make_schedule_key(READY_STATE)), timeline) is None:
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
                    pipeline.get(self.prefix_key(make_record_key(timeline, key)))

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

                record_keys = [self.prefix_key(make_record_key(timeline, key)) for key, score in records]
                pipeline.delete(digest_key, *record_keys)
                pipeline.zrem(self.prefix_key(make_schedule_key(READY_STATE)), timeline)
                pipeline.zadd(self.prefix_key(make_schedule_key(WAITING_STATE)), time.time() + self.interval, timeline)  # TODO: Better interval?
                pipeline.execute()

        def unschedule():
            with connection.pipeline() as pipeline:
                # Watch the timeline to ensure that no other transactions add
                # events to the timeline while we are trying to delete it.
                pipeline.watch(timeline_key)
                pipeline.multi()
                if connection.zcard(timeline_key) is 0:
                    pipeline.zrem(self.prefix_key(make_schedule_key(READY_STATE)), timeline)
                    pipeline.zrem(self.prefix_key(make_schedule_key(WAITING_STATE)), timeline)
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
