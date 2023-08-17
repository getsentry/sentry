import logging
import signal

logger = logging.getLogger(__name__)


def run_processor_with_signals(processor):
    def handler(signum, frame):
        processor.signal_shutdown()

    signal.signal(signal.SIGINT, handler)
    signal.signal(signal.SIGTERM, handler)
    processor.run()
