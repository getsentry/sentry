import dataclasses

from sentry.conf.types.kafka_definition import Topic


@dataclasses.dataclass
class UptimeRegionConfig:
    slug: str
    name: str
    config_topic: Topic
    enabled: bool
