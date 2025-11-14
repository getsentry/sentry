import faulthandler
import logging
import signal
import sys
import time
from threading import Thread
from typing import int, Any

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


def delay_shutdown(
    processor: StreamProcessor[Any],
    quantized_rebalance_delay_secs: int,
    dump_stacktrace_on_shutdown: bool,
) -> None:
    if quantized_rebalance_delay_secs:
        delay_kafka_rebalance(quantized_rebalance_delay_secs)

    if dump_stacktrace_on_shutdown:
        logger.info("Dumping stacktrace")
        faulthandler.dump_traceback(file=sys.stderr, all_threads=True)

    processor.signal_shutdown()


def run_processor_with_signals(
    processor: StreamProcessor[Any],
    quantized_rebalance_delay_secs: int | None = None,
    dump_stacktrace_on_shutdown: bool = False,
) -> None:
    if quantized_rebalance_delay_secs:
        # delay startup for quantization
        delay_kafka_rebalance(quantized_rebalance_delay_secs)

    def handler(signum: object, frame: object) -> None:
        # delay shutdown for quantization
        t = Thread(
            target=delay_shutdown,
            args=(processor, quantized_rebalance_delay_secs, dump_stacktrace_on_shutdown),
        )
        t.start()

    signal.signal(signal.SIGINT, handler)
    signal.signal(signal.SIGTERM, handler)
    processor.run()
