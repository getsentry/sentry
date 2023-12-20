import logging
import signal
import time
from datetime import datetime
from typing import Optional

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
    now = float(datetime.now().strftime("%S.%f"))

    next_tick, remainder = divmod(now, configured_delay)
    if remainder > 0:
        next_tick += 1

    seconds_sleep = (configured_delay * next_tick) - now

    time.sleep(seconds_sleep)


def run_processor_with_signals(processor, consumer_name: Optional[str] = None):
    def handler(signum, frame):
        if consumer_name == "ingest-generic-metrics" and options.get(
            "sentry-metrics.synchronize-kafka-rebalances"
        ):
            configured_delay = options.get("sentry-metrics.synchronized-rebalance-delay")
            delay_kafka_rebalance(configured_delay)
        processor.signal_shutdown()

    signal.signal(signal.SIGINT, handler)
    signal.signal(signal.SIGTERM, handler)
    processor.run()
