import logging
import signal
import time
from threading import Thread
from typing import Any

from arroyo.processing.processor import StreamProcessor

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
    sleep_secs = configured_delay - time_elapsed_in_slot

    logger.info("Sleeping for %s seconds to quantize rebalancing", sleep_secs)
    time.sleep(sleep_secs)


def delay_shutdown(processor: StreamProcessor[Any], quantized_rebalance_delay_secs: int) -> None:
    if quantized_rebalance_delay_secs:
        delay_kafka_rebalance(quantized_rebalance_delay_secs)

    processor.signal_shutdown()


def run_processor_with_signals(
    processor: StreamProcessor[Any], quantized_rebalance_delay_secs: int | None = None
) -> None:
    if quantized_rebalance_delay_secs:
        # delay startup for quantization
        delay_kafka_rebalance(quantized_rebalance_delay_secs)

    def handler(signum: object, frame: object) -> None:
        # delay shutdown for quantization
        t = Thread(target=delay_shutdown, args=(processor, quantized_rebalance_delay_secs))
        t.start()

    signal.signal(signal.SIGINT, handler)
    signal.signal(signal.SIGTERM, handler)
    processor.run()
