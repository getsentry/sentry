from __future__ import absolute_import, print_function

import click
import signal
from django.conf import settings

from sentry.runner.decorators import configuration


@click.command()
@click.option('--store-events-topic', default='store-events',
              help='Topic to consume raw events from.')
@click.option('--consumer-group', default='snuba-consumers',
              help='Consumer group use for consuming the raw events topic.')
@click.option('--bootstrap-server', default=settings.CONSUMER_DEFAULT_BROKERS, multiple=True,
              help='Kafka bootstrap server to use.')
@click.option('--max-batch-size', default=settings.CONSUMER_DEFAULT_MAX_BATCH_SIZE,
              help='Max number of messages to batch in memory before writing to Kafka.')
@click.option('--max-batch-time-ms', default=settings.CONSUMER_DEFAULT_MAX_BATCH_TIME_MS,
              help='Max length of time to buffer messages in memory before writing to Kafka.')
@click.option('--auto-offset-reset', default='error', type=click.Choice(['error', 'earliest', 'latest']),
              help='Kafka consumer auto offset reset.')
@click.option('--queued-max-messages-kbytes', default=50000, type=int,
              help='Maximum number of kilobytes per topic+partition in the local consumer queue.')
@click.option('--queued-min-messages', default=10000, type=int,
              help='Minimum number of messages per topic+partition librdkafka tries to maintain in the local consumer queue.')
@configuration
def storeconsumer(store_events_topic, consumer_group, bootstrap_server, max_batch_size,
                  max_batch_time_ms, auto_offset_reset, queued_max_messages_kbytes, queued_min_messages,
                  log_level):

    from batching_kafka_consumer import BatchingKafkaConsumer
    from sentry.event_consumer import EventConsumerWorker

    consumer = BatchingKafkaConsumer(
        store_events_topic,
        worker=EventConsumerWorker(),
        max_batch_size=max_batch_size,
        max_batch_time=max_batch_time_ms,
        bootstrap_servers=bootstrap_server,
        group_id=consumer_group,
        auto_offset_reset=auto_offset_reset,
    )

    def handler(signum, frame):
        consumer.signal_shutdown()

    signal.signal(signal.SIGINT, handler)

    consumer.run()
