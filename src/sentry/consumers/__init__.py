from typing import Mapping, TypedDict

from django.conf import settings


class ConsumerDefinition(TypedDict):
    topic: str
    strategy_factory: str


# consumer name -> consumer definition
KAFKA_CONSUMERS: Mapping[str, ConsumerDefinition] = {
    "ingest-profiles": {
        "topic": settings.KAFKA_PROFILES,
        "strategy_factory": "sentry.profiles.consumers.process.factory.ProcessProfileStrategyFactory",
    },
    "ingest-replay-recordings": {
        "topic": settings.KAFKA_INGEST_REPLAYS_RECORDINGS,
        "strategy_factory": "sentry.replays.consumers.recording.ProcessReplayRecordingStrategyFactory",
    },
}

for consumer in KAFKA_CONSUMERS:
    assert KAFKA_CONSUMERS[consumer]["topic"] in settings.KAFKA_TOPICS, consumer
