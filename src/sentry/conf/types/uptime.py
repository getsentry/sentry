import dataclasses


@dataclasses.dataclass
class UptimeRegionConfig:
    """
    Defines a region which uptime checks can be run in.
    """

    slug: str
    name: str
    # TODO: Remove once no region configurations are setting this
    enabled: bool = True
    # Temporarily defaulted for backwards compat
    config_redis_cluster: str = "default"
    # Prefix we'll add to keys in the redis config. Currently just used in tests
    config_redis_key_prefix: str = ""
