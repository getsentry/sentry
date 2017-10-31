from __future__ import absolute_import

import redis
import logging
import random

from django.conf import settings
from threading import Thread
from six.moves.queue import Queue


class PubSub():
    """
    Poster for a redis pubsub instance.

    put(channel, data) to send data to a redis pubsub
    channel. Maintains an internal queue for posting, will discard the
    value if the queue is full or not immediately available.
    """

    def __init__(self):
        self._started = False

    def _start(self):
        if self._started:
            return True

        connection = getattr(settings, 'PUBSUB_CONNECTION', None)
        try:
            host, port, db = connection
        except (TypeError, ValueError):
            return False
        self.rds = redis.StrictRedis(
            host=host,
            port=port,
            db=db,
            socket_timeout=0.2,
            socket_connect_timeout=1,
        )

        self.q = q = Queue(maxsize=100)

        def worker():
            while True:
                (channel, data) = q.get()
                try:
                    self.rds.publish(channel, data)
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

    def put(self, channel, data):
        if not self._start():
            return

        sample_channel = getattr(settings, 'PUBSUB_SAMPLING', {}).get(channel, 1.0)
        if random.random() <= sample_channel:
            try:
                self.q.put((channel, data), block=False)
            except Queue.Full:
                return

pubsub = PubSub()
