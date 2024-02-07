import logging
import signal
import time
from threading import Thread

from sentry import options

logger = logging.getLogger(__name__)


def delay_kafka_rebalance(configured_delay: int) -> None:
    """
    Introduces a configurable delay to the consumer topic
    subscription and consumer shutdown steps (handled by the
    StreamProcessor). The idea behind is that by forcing
    these steps to occur at certain time "ticks" (for example, at
    every 15 second tick in a minute), we can reduce the number of
    rebalances that are triggered during a deploy. This means
    fewer "stop the world rebalancing" occurrences and more time
    for the consumer group to stabilize and make progress.
    """

    time_elapsed_in_slot = int(time.time()) % configured_delay

    time.sleep(configured_delay - time_elapsed_in_slot)


def delay_shutdown(consumer_name, processor) -> None:
    if consumer_name == "ingest-generic-metrics" and options.get(
        "sentry-metrics.synchronize-kafka-rebalances"
    ):
        configured_delay = options.get("sentry-metrics.synchronized-rebalance-delay")
        logger.info("Started delay in consumer shutdown step")
        delay_kafka_rebalance(configured_delay)
        logger.info("Finished delay in consumer shutdown step")
    processor.signal_shutdown()


def run_processor_with_signals(processor, consumer_name: str | None = None):
    def handler(signum, frame):
        t = Thread(target=delay_shutdown, args=(consumer_name, processor))
        t.start()

    signal.signal(signal.SIGINT, handler)
    signal.signal(signal.SIGTERM, handler)
    processor.run()
