import dataclasses

from sentry.conf.types.kafka_definition import Topic


@dataclasses.dataclass
class UptimeRegionConfig:
    """
    Defines a region which uptime checks can be run in.
    """

    slug: str
    name: str
    config_topic: Topic
    enabled: bool
    # Temporarily defaulted for backwards compat
    config_redis_cluster: str = "default"
