from __future__ import absolute_import

import redis
import logging
import random

from django.conf import settings
from threading import Thread
from six.moves.queue import Queue, Full


class QueuedPublisher():
    """
    A publisher that queues items locally and publishes them to a
    remote pubsub service on a background thread.

    Maintains a lossy internal queue for posting, will discard the
    value if the queue is full or not immediately available. Will also
    drop items if the publish operation to the remote service fails.
    """

    def __init__(self, publisher):
        self._started = False
        self.publisher = publisher

    def _start(self):
        if self._started:
            return True

        self.q = q = Queue(maxsize=100)

        def worker():
            while True:
                (channel, item) = q.get()
                try:
                    self.publisher.publish(channel, item)
                except Exception:
                    logger = logging.getLogger('sentry.errors')
                    logger.debug('could not submit event to pubsub')
                finally:
                    q.task_done()

        t = Thread(target=worker)
        t.setDaemon(True)
        t.start()

        self._started = True
        return True

    def publish(self, channel, item):
        if not self._start():
            return

        sample_channel = getattr(settings, 'PUBSUB_SAMPLING', 1.0)
        if random.random() <= sample_channel:
            try:
                self.q.put((channel, item), block=False)
            except Full:
                return


class RedisPublisher():
    def __init__(self, connection):
        self.rds = None if connection is None else redis.StrictRedis(**connection)

    def publish(self, channel, item):
        if self.rds is not None:
            self.rds.publish(channel, item)
