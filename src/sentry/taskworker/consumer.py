import logging
import signal
from typing import Any

import sentry_sdk
from arroyo.backends.kafka.configuration import build_kafka_consumer_configuration
from arroyo.backends.kafka.consumer import KafkaConsumer
from arroyo.commit import ONCE_PER_SECOND
from arroyo.processing.processor import StreamProcessor
from arroyo.types import Topic

from sentry.taskworker.processors.strategy_factory import StrategyFactory

logging.basicConfig(
    level=getattr(logging, "INFO"),
    format="%(asctime)s %(message)s",
    force=True,
)
logger = logging.getLogger(__name__)


def run(
    kafka_consumer_bootstrap_servers="127.0.0.1:9092",
    source_topic="hackweek",
    group_id="hackweek-kafkatasks",
    auto_offset_reset="earliest",
):
    logger.info("starting consumer")
    sentry_sdk.init(
        dsn="https://56be405b1fe28a57d5c77b887ac2eacb@o1.ingest.us.sentry.io/4507805868490752",
        traces_sample_rate=1.0,
        profiles_sample_rate=1.0,
    )

    TOPIC = Topic(source_topic)
    consumer_bootstrap_servers = kafka_consumer_bootstrap_servers.split(",")
    consumer = KafkaConsumer(
        build_kafka_consumer_configuration(
            default_config={},
            bootstrap_servers=consumer_bootstrap_servers,
            auto_offset_reset=auto_offset_reset,
            group_id=group_id,
        )
    )

    factory = StrategyFactory(
        max_batch_size=2,
        max_batch_time=2,
        num_processes=3,
        input_block_size=1000,
        output_block_size=1000,
    )

    processor = StreamProcessor(
        consumer=consumer,
        topic=TOPIC,
        processor_factory=factory,
        commit_policy=ONCE_PER_SECOND,
    )

    def handler(signum: int, frame: Any) -> None:
        logger.info("Shutting down consumer")
        processor.signal_shutdown()

    signal.signal(signal.SIGINT, handler)
    signal.signal(signal.SIGTERM, handler)

    processor.run()


if __name__ == "__main__":
    run()
