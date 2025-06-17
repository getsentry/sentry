import time
import zlib
from base64 import b64encode
from collections.abc import Iterable, Mapping

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import Commit, Message, Partition

from sentry import options
from sentry.processing.backpressure.arroyo import HealthChecker, create_backpressure_step
from sentry.profiles.task import process_profile_task
from sentry.utils import metrics


def process_message(message: Message[KafkaPayload]) -> None:
    sampled = is_sampled(message.payload.headers)

    if sampled or options.get("profiling.profile_metrics.unsampled_profiles.enabled"):
        start_time = time.perf_counter()
        b64encoded_compressed = b64encode(
            zlib.compress(
                message.payload.value,
                level=options.get("taskworker.try_compress.profile_metrics.level"),
            )
        ).decode("utf-8")
        end_time = time.perf_counter()
        metrics.distribution(
            "profiling.profile_metrics.compression_time",
            end_time - start_time,
        )
        process_profile_task.delay(
            payload=b64encoded_compressed, sampled=sampled, compressed_profile=True
        )


class ProcessProfileStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(self) -> None:
        super().__init__()
        self.health_checker = HealthChecker("profiles")

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        next_step = RunTask(
            function=process_message,
            next_step=CommitOffsets(commit),
        )
        return create_backpressure_step(
            health_checker=self.health_checker,
            next_step=next_step,
        )


def is_sampled(headers: Iterable[tuple[str, str | bytes]]) -> bool:
    for k, v in headers:
        if k == "sampled":
            if isinstance(v, bytes):
                return v.decode("utf-8") == "true"
    return True
