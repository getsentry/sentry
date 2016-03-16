from __future__ import absolute_import

import itertools
import logging
import random
import time
from contextlib import contextmanager

from redis.exceptions import ResponseError, WatchError

from sentry.digests import Record, ScheduleEntry
from sentry.digests.backends.base import Backend, InvalidState
from sentry.utils.cache import Lock
from sentry.utils.redis import (
    check_cluster_versions, get_cluster_from_options, load_script
)
from sentry.utils.versioning import Version

logger = logging.getLogger('sentry.digests')

SCHEDULE_PATH_COMPONENT = 's'
SCHEDULE_STATE_WAITING = 'w'
SCHEDULE_STATE_READY = 'r'

TIMELINE_DIGEST_PATH_COMPONENT = 'd'
TIMELINE_LAST_PROCESSED_TIMESTAMP_PATH_COMPONENT = 'l'
TIMELINE_PATH_COMPONENT = 't'
TIMELINE_RECORD_PATH_COMPONENT = 'r'


def ilen(iterator):
    i = 0
    for i, _ in enumerate(iterator):
        pass
    return i


def make_schedule_key(namespace, state):
    return '{0}:{1}:{2}'.format(namespace, SCHEDULE_PATH_COMPONENT, state)


def make_timeline_key(namespace, key):
    return '{0}:{1}:{2}'.format(namespace, TIMELINE_PATH_COMPONENT, key)


def make_last_processed_timestamp_key(timeline_key):
    return '{0}:{1}'.format(timeline_key, TIMELINE_LAST_PROCESSED_TIMESTAMP_PATH_COMPONENT)


def make_digest_key(timeline_key):
    return '{0}:{1}'.format(timeline_key, TIMELINE_DIGEST_PATH_COMPONENT)


def make_record_key(timeline_key, record):
    return '{0}:{1}:{2}'.format(timeline_key, TIMELINE_RECORD_PATH_COMPONENT, record)


ensure_timeline_scheduled = load_script('digests/ensure_timeline_scheduled.lua')
truncate_timeline = load_script('digests/truncate_timeline.lua')


class RedisBackend(Backend):
    """
    Implements the digest backend API, backed by Redis.

    Each timeline is modeled as a sorted set, and also maintains a separate key
    that contains the last time the digest was processed (used for scheduling.)

    .. code::

        redis:6379> ZREVRANGEBYSCORE "d:t:mail:p:1" inf -inf WITHSCORES
        1) "433be20b807c4cd49a132de69c0f6c55"
        2) "1444847625"
        3) "0f9d5fe4b5b3400fab85d9a841aa8467"
        4) "1444847625"
        ...

    The timeline contains references to several records, which are stored
    separately, encoded using the codec provided to the backend:

    .. code::

        redis:6379> GET "d:t:mail:p:1:r:433be20b807c4cd49a132de69c0f6c55"
        [ binary content ]

    When the timeline is ready to be digested, the timeline set is renamed,
    creating a digest set (in this case the key would be ``d:t:mail:p:1:d``),
    that represents a snapshot of the timeline contents at that point in time.
    (If the digest set already exists, the timeline contents are instead
    unioned into the digest set and then the timeline is cleared.) This allows
    new records to be added to the timeline that will be processed after the
    next scheduling interval without the risk of data loss due to race
    conditions between the record addition and digest generation and delivery.

    Schedules are modeled as two sorted sets -- one for ``waiting`` items, and
    one for ``ready`` items. Items in the ``waiting`` set are scored by the
    time at which they should be transitioned to the ``ready`` set.  Items in
    the ``ready`` set are scored by the time at which they were scheduled to be
    added to the ``ready`` set. Iterating each set from oldest to newest yields
    the highest priority items for action (moving from the ``waiting`` to
    ``ready`` set, or delivering a digest for the ``waiting`` and ``ready``
    set, respectively.)

    .. code::

        redis:6379> ZREVRANGEBYSCORE "d:s:w" inf -inf WITHSCORES
        1) "mail:p:1"
        2) "1444847638"

    """
    def __init__(self, **options):
        self.cluster, options = get_cluster_from_options('SENTRY_DIGESTS_OPTIONS', options)

        self.namespace = options.pop('namespace', 'd')

        # Sets the time-to-live (in seconds) for records, timelines, and
        # digests. This can (and should) be a relatively high value, since
        # timelines, digests, and records should all be deleted after they have
        # been processed -- this is mainly to ensure stale data doesn't hang
        # around too long in the case of a configuration error. This should be
        # larger than the maximum scheduling delay to ensure data is not evicted
        # too early.
        self.ttl = options.pop('ttl', 60 * 60)

        super(RedisBackend, self).__init__(**options)

    def validate(self):
        logger.debug('Validating Redis version...')
        check_cluster_versions(
            self.cluster,
            Version((2, 8, 9)),
            label='Digests',
        )

    def add(self, key, record, increment_delay=None, maximum_delay=None):
        if increment_delay is None:
            increment_delay = self.increment_delay

        if maximum_delay is None:
            maximum_delay = self.maximum_delay

        timeline_key = make_timeline_key(self.namespace, key)
        record_key = make_record_key(timeline_key, record.key)

        connection = self.cluster.get_local_client_for_key(timeline_key)
        with connection.pipeline() as pipeline:
            pipeline.multi()

            pipeline.set(
                record_key,
                self.codec.encode(record.value),
                ex=self.ttl,
            )

            # In the future, it might make sense to prefix the entry with the
            # timestamp (lexicographically sortable) to ensure that we can
            # maintain the correct sort order with abitrary precision:
            # http://redis.io/commands/ZADD#elements-with-the-same-score
            pipeline.zadd(timeline_key, record.timestamp, record.key)
            pipeline.expire(timeline_key, self.ttl)

            ensure_timeline_scheduled(
                pipeline,
                (
                    make_schedule_key(self.namespace, SCHEDULE_STATE_WAITING),
                    make_schedule_key(self.namespace, SCHEDULE_STATE_READY),
                    make_last_processed_timestamp_key(timeline_key),
                ),
                (
                    key,
                    record.timestamp,
                    increment_delay,
                    maximum_delay,
                ),
            )

            should_truncate = random.random() < self.truncation_chance
            if should_truncate:
                truncate_timeline(
                    pipeline,
                    (timeline_key,),
                    (self.capacity, timeline_key),
                )

            results = pipeline.execute()
            if should_truncate:
                logger.info('Removed %s extra records from %s.', results[-1], key)

            return results[-2 if should_truncate else -1]

    def schedule(self, deadline, chunk=1000):
        # TODO: This doesn't lead to a fair balancing of workers, ideally each
        # scheduling task would be executed by a different process for each
        # host. There is also no failure isolation here, so a single shard
        # failure will cause the remainder of the shards to not be able to be
        # scheduled.
        for host in self.cluster.hosts:
            connection = self.cluster.get_local_client(host)

            with Lock('{0}:s:{1}'.format(self.namespace, host), nowait=True, timeout=30):
                # Prevent a runaway loop by setting a maximum number of
                # iterations. Note that this limits the total number of
                # expected items in any specific scheduling interval to chunk *
                # maximum_iterations.
                maximum_iterations = 1000
                for i in xrange(maximum_iterations):
                    items = connection.zrangebyscore(
                        make_schedule_key(self.namespace, SCHEDULE_STATE_WAITING),
                        min=0,
                        max=deadline,
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
                            make_schedule_key(self.namespace, SCHEDULE_STATE_WAITING),
                            *[key for key, timestamp in items]
                        )

                        pipeline.zadd(
                            make_schedule_key(self.namespace, SCHEDULE_STATE_READY),
                            *itertools.chain.from_iterable([(timestamp, key) for (key, timestamp) in items])
                        )

                        for key, timestamp in items:
                            yield ScheduleEntry(key, timestamp)

                        pipeline.execute()

                    # If we retrieved less than the chunk size of items, we don't
                    # need try to retrieve more items.
                    if len(items) < chunk:
                        break
                else:
                    raise RuntimeError('loop exceeded maximum iterations (%s)' % (maximum_iterations,))

    def maintenance(self, deadline, chunk=1000):
        # TODO: This needs tests!

        # TODO: This suffers from the same shard isolation issues as
        # ``schedule``. Ideally, this would also return the number of items
        # that were rescheduled (and possibly even how late they were at the
        # point of rescheduling) but that causes a bit of an API issue since in
        # the case of an error, this can be considered a partial success (but
        # still should raise an exception.)
        for host in self.cluster.hosts:
            connection = self.cluster.get_local_client(host)

            extra = 0
            start = 0
            maximum_iterations = 1000
            for i in xrange(maximum_iterations):
                fetch_size = chunk + extra
                items = connection.zrangebyscore(
                    make_schedule_key(self.namespace, SCHEDULE_STATE_READY),
                    min=start,
                    max=deadline,
                    withscores=True,
                    start=0,
                    num=fetch_size,
                )

                def try_lock(item):
                    """
                    Attempt to immedately acquire a lock on the timeline at
                    key, returning the lock if it can be acquired, otherwise
                    returning ``None``.
                    """
                    key, timestamp = item
                    lock = Lock(make_timeline_key(self.namespace, key), timeout=5, nowait=True)
                    return lock if lock.acquire() else None, item

                # Try to take out a lock on each item. If we can't acquire the
                # lock, that means this is currently being digested and cannot
                # be rescheduled.
                can_reschedule = {
                    True: [],
                    False: [],
                }

                for result in map(try_lock, items):
                    can_reschedule[result[0] is not None].append(result)

                logger.debug('Fetched %s items, able to reschedule %s.', len(items), len(can_reschedule[True]))

                # Set the start position for the next query. (If there are no
                # items, we don't need to worry about this, since there won't
                # be a next query.) If all items share the same score and are
                # locked, the iterator will never advance (we will keep trying
                # to schedule the same locked items over and over) and either
                # eventually progress slowly as items are unlocked, or hit the
                # maximum iterations boundary. A possible solution to this
                # would be to count the number of items that have the maximum
                # score in this page that we assume we can't acquire (since we
                # couldn't acquire the lock this iteration) and add that count
                # to the next query limit. (This unfortunately could also
                # lead to unbounded growth too, so we have to limit it as well.)
                if items:
                    start = items[-1][0]  # (This value is (key, timestamp).)
                    extra = min(
                        ilen(
                            itertools.takewhile(
                                lambda (lock, (key, timestamp)): timestamp == start,
                                can_reschedule[False][::-1],
                            ),
                        ),
                        chunk,
                    )

                # XXX: We need to perform this check before the transaction to
                # ensure that we don't execute an empty transaction. (We'll
                # need to perform a similar check after the completion of the
                # transaction as well.)
                if not can_reschedule[True]:
                    if len(items) == fetch_size:
                        # There is nothing to reschedule in this chunk, but we
                        # need check if there are others after this chunk.
                        continue
                    else:
                        # There is nothing to unlock, and we've exhausted all items.
                        break

                try:
                    with connection.pipeline() as pipeline:
                        pipeline.multi()

                        pipeline.zrem(
                            make_schedule_key(self.namespace, SCHEDULE_STATE_READY),
                            *[key for (lock, (key, timestamp)) in can_reschedule[True]]
                        )

                        pipeline.zadd(
                            make_schedule_key(self.namespace, SCHEDULE_STATE_WAITING),
                            *itertools.chain.from_iterable([(timestamp, key) for (lock, (key, timestamp)) in can_reschedule[True]])
                        )

                        pipeline.execute()
                finally:
                    # Regardless of the outcome of the transaction, we should
                    # try to unlock the items for processing.
                    for lock, item in can_reschedule[True]:
                        try:
                            lock.release()
                        except Exception as error:
                            # XXX: This shouldn't be hit (the ``Lock`` code
                            # should swallow the exception) but this is here
                            # for safety anyway.
                            logger.warning('Could not unlock %r: %s', item, error)

                # If we retrieved less than the chunk size of items, we don't
                # need try to retrieve more items.
                if len(items) < fetch_size:
                    break
            else:
                raise RuntimeError('loop exceeded maximum iterations (%s)' % (maximum_iterations,))

    @contextmanager
    def digest(self, key, minimum_delay=None):
        if minimum_delay is None:
            minimum_delay = self.minimum_delay

        timeline_key = make_timeline_key(self.namespace, key)
        digest_key = make_digest_key(timeline_key)

        connection = self.cluster.get_local_client_for_key(timeline_key)

        with Lock(timeline_key, nowait=True, timeout=30):
            # Check to ensure the timeline is in the correct state ("ready")
            # before sending. This acts as a throttling mechanism to prevent
            # sending a digest before it's next scheduled delivery time in a
            # race condition scenario.
            if connection.zscore(make_schedule_key(self.namespace, SCHEDULE_STATE_READY), key) is None:
                raise InvalidState('Timeline is not in the ready state.')

            with connection.pipeline() as pipeline:
                pipeline.watch(digest_key)  # This shouldn't be necessary, but better safe than sorry?

                if pipeline.exists(digest_key):
                    pipeline.multi()
                    pipeline.zunionstore(digest_key, (timeline_key, digest_key), aggregate='max')
                    pipeline.delete(timeline_key)
                    pipeline.expire(digest_key, self.ttl)
                    pipeline.execute()
                else:
                    pipeline.multi()
                    pipeline.rename(timeline_key, digest_key)
                    pipeline.expire(digest_key, self.ttl)
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

            def get_records_for_digest():
                with connection.pipeline(transaction=False) as pipeline:
                    for record_key, timestamp in records:
                        pipeline.get(make_record_key(timeline_key, record_key))

                    for (record_key, timestamp), value in zip(records, pipeline.execute()):
                        # We have to handle failures if the key does not exist --
                        # this could happen due to evictions or race conditions
                        # where the record was added to a timeline while it was
                        # already being digested.
                        if value is None:
                            logger.warning('Could not retrieve event for timeline.')
                        else:
                            yield Record(record_key, self.codec.decode(value), timestamp)

            yield itertools.islice(get_records_for_digest(), self.capacity)

            def cleanup_records(pipeline):
                record_keys = [make_record_key(timeline_key, record_key) for record_key, score in records]
                pipeline.delete(digest_key, *record_keys)

            def reschedule():
                with connection.pipeline() as pipeline:
                    pipeline.watch(digest_key)  # This shouldn't be necessary, but better safe than sorry?
                    pipeline.multi()

                    cleanup_records(pipeline)
                    pipeline.zrem(make_schedule_key(self.namespace, SCHEDULE_STATE_READY), key)
                    pipeline.zadd(make_schedule_key(self.namespace, SCHEDULE_STATE_WAITING), time.time() + minimum_delay, key)
                    pipeline.setex(make_last_processed_timestamp_key(timeline_key), self.ttl, int(time.time()))
                    pipeline.execute()

            def unschedule():
                with connection.pipeline() as pipeline:
                    # Watch the timeline to ensure that no other transactions add
                    # events to the timeline while we are trying to delete it.
                    pipeline.watch(timeline_key)
                    pipeline.multi()
                    if connection.zcard(timeline_key) == 0:
                        cleanup_records(pipeline)
                        pipeline.delete(make_last_processed_timestamp_key(timeline_key))
                        pipeline.zrem(make_schedule_key(self.namespace, SCHEDULE_STATE_READY), key)
                        pipeline.zrem(make_schedule_key(self.namespace, SCHEDULE_STATE_WAITING), key)
                        pipeline.execute()

            # If there were records in the digest, we need to schedule it so
            # that we schedule any records that were added during digestion. If
            # there were no items, we can try to remove the timeline from the
            # digestion schedule.
            if records:
                reschedule()
            else:
                try:
                    unschedule()
                except WatchError:
                    logger.debug('Could not remove timeline from schedule, rescheduling instead')
                    reschedule()

    def delete(self, key):
        timeline_key = make_timeline_key(self.namespace, key)

        connection = self.cluster.get_local_client_for_key(timeline_key)
        with Lock(timeline_key, nowait=True, timeout=30), \
                connection.pipeline() as pipeline:
            truncate_timeline(pipeline, (timeline_key,), (0, timeline_key))
            truncate_timeline(pipeline, (make_digest_key(timeline_key),), (0, timeline_key))
            pipeline.delete(make_last_processed_timestamp_key(timeline_key))
            pipeline.zrem(make_schedule_key(self.namespace, SCHEDULE_STATE_READY), key)
            pipeline.zrem(make_schedule_key(self.namespace, SCHEDULE_STATE_WAITING), key)
            pipeline.execute()
