from __future__ import absolute_import

import abc
import logging
import signal as os_signal
from contextlib import contextmanager

import six
import confluent_kafka as kafka
from django.conf import settings

from sentry.utils import metrics

logger = logging.getLogger(__name__)


class ProducerManager(object):
    """
    Manages one `confluent_kafka.Producer` per Kafka cluster.

    See `KAFKA_CLUSTERS` and `KAFKA_TOPICS` in settings.
    """

    def __init__(self):
        self.__producers = {}

    def get(self, key):
        cluster_name = settings.KAFKA_TOPICS[key]["cluster"]
        producer = self.__producers.get(cluster_name)

        if producer:
            return producer

        from confluent_kafka import Producer

        cluster_options = settings.KAFKA_CLUSTERS[cluster_name]
        producer = self.__producers[cluster_name] = Producer(cluster_options)
        return producer


producers = ProducerManager()


@contextmanager
def set_termination_request_handlers(handler):
    # hook the new handlers
    old_sigint = os_signal.signal(os_signal.SIGINT, handler)
    old_sigterm = os_signal.signal(os_signal.SIGTERM, handler)
    try:
        # run the code inside the with context ( with the hooked handler)
        yield
    finally:
        # restore the old handlers when exiting the with context
        os_signal.signal(os_signal.SIGINT, old_sigint)
        os_signal.signal(os_signal.SIGTERM, old_sigterm)


@six.add_metaclass(abc.ABCMeta)
class SimpleKafkaConsumer(object):
    def __init__(
        self,
        commit_batch_size,
        consumer_group,
        topic_name,
        max_fetch_time_seconds,
        initial_offset_reset="latest",
        consumer_configuration=None,
    ):
        """
        Base class for implementing kafka consumers.
        """

        self.commit_batch_size = commit_batch_size
        self.topic_name = topic_name
        self.max_fetch_time_seconds = max_fetch_time_seconds
        self.initial_offset_reset = initial_offset_reset
        self.consumer_group = consumer_group

        if self.commit_batch_size <= 0:
            raise ValueError("Commit batch size must be a positive integer")

        cluster_name = settings.KAFKA_TOPICS[topic_name]["cluster"]
        bootstrap_servers = settings.KAFKA_CLUSTERS[cluster_name]["bootstrap.servers"]

        self.consumer_configuration = {
            "bootstrap.servers": bootstrap_servers,
            "group.id": consumer_group,
            "enable.auto.commit": "false",  # we commit manually
            "enable.auto.offset.store": "true",  # we let the broker keep count of the current offset (when committing)
            "enable.partition.eof": "false",  # stop EOF errors when we read all messages in the topic
            "default.topic.config": {"auto.offset.reset": initial_offset_reset},
        }

        if consumer_configuration is not None:
            for key in six.iterkeys(consumer_configuration):
                self.consumer_configuration[key] = consumer_configuration[key]

    @abc.abstractmethod
    def process_message(self, message):
        """
        This function is called for each message
        :param message: the kafka message:
        """
        pass

    def run(self, is_shutdown_requested=lambda: False):
        """
        Runs the message processing loop
        """
        logger.debug(
            "Staring kafka consumer for topic:%s with consumer group:%s",
            self.topic_name,
            self.consumer_group,
        )

        consumer = kafka.Consumer(self.consumer_configuration)
        consumer.subscribe([self.topic_name])

        metrics_tags = {
            "topic": self.topic_name,
            "consumer_group": self.consumer_group,
            "type": self.__class__.__name__,
        }

        # setup a flag to mark termination signals received, see below why we use an array
        termination_signal_received = [False]

        def termination_signal_handler(_sig_id, _frame):
            """
            Function to use a hook for SIGINT and SIGTERM

            This signal handler only remembers that the signal was emitted.
            The batch processing loop detects that the signal was emitted
            and stops once the whole batch is processed.
            """
            # We need to use an array so that terminal_signal_received is not a
            # local variable assignment, but a lookup in the clojure's outer scope.
            termination_signal_received[0] = True

        with set_termination_request_handlers(termination_signal_handler):
            while not (is_shutdown_requested() or termination_signal_received[0]):
                # get up to commit_batch_size messages
                messages = consumer.consume(
                    num_messages=self.commit_batch_size, timeout=self.max_fetch_time_seconds
                )

                for message in messages:
                    message_error = message.error()
                    if message_error is not None:
                        logger.error(
                            "Received message with error on %s: %s", self.topic_name, message_error
                        )
                        raise ValueError(
                            "Bad message received from consumer", self.topic_name, message_error
                        )

                    with metrics.timer("simple_consumer.processing_time", tags=metrics_tags):
                        self.process_message(message)

                if len(messages) > 0:
                    # we have read some messages in the previous consume, commit the offset
                    consumer.commit(asynchronous=False)

                metrics.timing(
                    "simple_consumer.committed_batch.size", len(messages), tags=metrics_tags
                )
                # Value between 0.0 and 1.0 that can help to estimate the consumer bandwidth/usage
                metrics.timing(
                    "simple_consumer.batch_capacity.usage",
                    1.0 * len(messages) / self.commit_batch_size,
                    tags=metrics_tags,
                )

        consumer.close()
        logger.debug(
            "Closing kafka consumer for topic:%s with consumer group:%s",
            self.topic_name,
            self.consumer_group,
        )
