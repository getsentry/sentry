from base64 import b64encode
from collections.abc import Iterable, Mapping

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import Commit, Message, Partition

from sentry import options
from sentry.killswitches import killswitch_matches_context
from sentry.processing.backpressure.arroyo import HealthChecker, create_backpressure_step
from sentry.profiles.task import process_profile_task


def process_message(message: Message[KafkaPayload]) -> None:
    if should_drop(message.payload.headers):
        return

    sampled = is_sampled(message.payload.headers)

    if sampled or options.get("profiling.profile_metrics.unsampled_profiles.enabled"):
        b64encoded = b64encode(message.payload.value).decode("utf-8")
        process_profile_task.delay(payload=b64encoded, sampled=sampled)


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


HEADER_KEYS = {"project_id"}


def should_drop(headers: Iterable[tuple[str, str | bytes]]) -> bool:
    context = {}
    for k, v in headers:
        if k == "project_id" and isinstance(v, bytes):
            context[k] = v.decode("utf-8")

    if "project_id" in context and killswitch_matches_context(
        "profiling.killswitch.ingest-profiles", context
    ):
        return True

    return False
