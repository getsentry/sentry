import logging
import signal
from typing import Optional

logger = logging.getLogger(__name__)


def run_processor_with_signals(processor, consumer_name: Optional[str]):
    def handler(signum, frame):
        # if consumer name is generic metrics
        # then call delay_kafka_rebalance
        processor.signal_shutdown()

    signal.signal(signal.SIGINT, handler)
    signal.signal(signal.SIGTERM, handler)
    processor.run()
