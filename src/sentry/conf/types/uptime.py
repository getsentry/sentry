import dataclasses

from sentry.conf.types.kafka_definition import Topic


@dataclasses.dataclass
class UptimeRegionConfig:
    """
    Defines a region which uptime checks can be run in.
    """

    slug: str
    name: str
    enabled: bool
    # TODO: Remove once we've removed config that relies on this
    config_topic: Topic | None = None
    # Temporarily defaulted for backwards compat
    config_redis_cluster: str = "default"
    # Prefix we'll add to keys in the redis config. Currently just used in tests
    config_redis_key_prefix: str = ""
