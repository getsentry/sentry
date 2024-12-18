import dataclasses

from sentry.conf.types.kafka_definition import Topic


@dataclasses.dataclass
class UptimeRegionConfig:
    """
    Defines an available region which an uptime-checker is run in.
    """
    slug: str
    name: str
    config_topic: Topic
    enabled: bool
