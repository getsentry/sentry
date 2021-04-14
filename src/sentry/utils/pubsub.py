import logging
from queue import Full, Queue
from threading import Thread

import redis


class QueuedPublisherService:
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
                (channel, key, value) = q.get()
                try:
                    self.publisher.publish(channel, key=key, value=value)
                except Exception as e:
                    logger = logging.getLogger("sentry.errors")
                    logger.debug("could not submit event to pubsub: %s" % e)
                finally:
                    q.task_done()

        t = Thread(target=worker)
        t.setDaemon(True)
        t.start()

        self._started = True
        return True

    def publish(self, channel, value, key=None):
        if not self._start():
            return

        try:
            self.q.put((channel, key, value), block=False)
        except Full:
            return


class RedisPublisher:
    def __init__(self, connection):
        self.rds = None if connection is None else redis.StrictRedis(**connection)

    def publish(self, channel, value, key=None):
        if self.rds is not None:
            self.rds.publish(channel, value)


class KafkaPublisher:
    def __init__(self, connection, asynchronous=True):
        from confluent_kafka import Producer

        self.producer = Producer(connection or {})
        self.asynchronous = asynchronous

    def publish(self, channel, value, key=None):
        self.producer.produce(topic=channel, value=value, key=key)
        if self.asynchronous:
            self.producer.poll(0)
        else:
            self.producer.flush()
