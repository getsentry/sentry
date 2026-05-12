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

# Headers from consumer are Iterable[tuple[str, str | bytes]], from taskbroker are dict[str, str]
Headers = Iterable[tuple[str, str | bytes]] | dict[str, str]


def _process_profile_message(
    message_bytes: bytes,
    headers: Headers,
    inline: bool = False,
) -> None:
    """Process a profile message from Kafka. Used by both consumer and taskbroker passthrough."""
    if should_drop(headers):
        return

    sampled = is_sampled(headers)

    if not sampled and not options.get("profiling.profile_metrics.unsampled_profiles.enabled"):
        return

    if inline:
        process_profile_task(payload=message_bytes, sampled=sampled)
    else:
        process_profile_task.delay(payload=message_bytes, sampled=sampled)


def process_message(message: Message[KafkaPayload]) -> None:
    _process_profile_message(message.payload.value, message.payload.headers)


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


def is_sampled(headers: Headers) -> bool:
    if isinstance(headers, dict):
        return headers.get("sampled", "true") == "true"
    for k, v in headers:
        if k == "sampled":
            if isinstance(v, bytes):
                return v.decode("utf-8") == "true"
    return True


def should_drop(headers: Headers) -> bool:
    if isinstance(headers, dict):
        context = {"project_id": headers["project_id"]} if "project_id" in headers else {}
    else:
        context = {}
        for k, v in headers:
            if k == "project_id" and isinstance(v, bytes):
                context[k] = v.decode("utf-8")

    if "project_id" in context and killswitch_matches_context(
        "profiling.killswitch.ingest-profiles", context
    ):
        return True

    return False
