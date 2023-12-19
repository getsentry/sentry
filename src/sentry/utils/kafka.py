import logging
import signal
from typing import Optional

from sentry import options
from sentry.runner.commands.run import delay_kafka_rebalance

logger = logging.getLogger(__name__)


def run_processor_with_signals(processor, consumer_name: Optional[str]):
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
