from typing import Any, MutableMapping, NamedTuple, Optional

from django.conf import settings

SUPPORTED_KAFKA_CONFIGURATION = (
    # Check https://github.com/edenhill/librdkafka/blob/master/CONFIGURATION.md
    # for the full list of available options
    "bootstrap.servers",
    "compression.type",
    "message.max.bytes",
    "sasl.mechanism",
    "sasl.username",
    "sasl.password",
    "security.protocol",
    "session.timeout.ms",
    "socket.timeout.ms",
    "ssl.ca.location",
    "ssl.ca.certificate.stores",
    "ssl.certificate.location",
    "ssl.certificate.pem",
    "ssl.cipher.suites",
    "ssl.crl.location",
    "ssl.curves.list",
    "ssl.endpoint.identification.algorithm",
    "ssl.key.location",
    "ssl.key.password",
    "ssl.key.pem",
    "ssl.keystore.location",
    "ssl.keystore.password",
    "ssl.sigalgs.list",
)
COMMON_SECTION = "common"
PRODUCERS_SECTION = "producers"
CONSUMERS_SECTION = "consumers"
ADMIN_SECTION = "admin"
KNOWN_SECTIONS = (COMMON_SECTION, PRODUCERS_SECTION, CONSUMERS_SECTION, ADMIN_SECTION)


def _get_legacy_kafka_cluster_options(cluster_name):
    options = settings.KAFKA_CLUSTERS[cluster_name]

    options = {k: v for k, v in options.items() if k not in KNOWN_SECTIONS}
    if "bootstrap.servers" in options:
        if isinstance(options["bootstrap.servers"], (list, tuple)):
            options["bootstrap.servers"] = ",".join(options["bootstrap.servers"])
    return options


def _get_kafka_cluster_options(
    cluster_name, config_section, only_bootstrap=False, override_params=None
):
    options = {}
    custom_options = settings.KAFKA_CLUSTERS[cluster_name].get(config_section, {})
    common_options = settings.KAFKA_CLUSTERS[cluster_name].get(COMMON_SECTION, {})
    legacy_options = _get_legacy_kafka_cluster_options(cluster_name)
    if legacy_options:
        assert "bootstrap.servers" in legacy_options
        if only_bootstrap:
            options["bootstrap.servers"] = legacy_options["bootstrap.servers"]
        else:
            # producer uses all legacy_options
            options.update(legacy_options)
    else:
        options.update(common_options)
        options.update(custom_options)
        # check key validity
        for configuration_key in options:
            if configuration_key not in SUPPORTED_KAFKA_CONFIGURATION:
                raise ValueError(f"The `{configuration_key}` configuration key is not supported.")
    if not isinstance(options["bootstrap.servers"], str):
        raise ValueError("bootstrap.servers must be a comma separated string")
    if override_params:
        options.update(override_params)
    return options


def get_kafka_producer_cluster_options(cluster_name):
    return _get_kafka_cluster_options(cluster_name, PRODUCERS_SECTION)


class ConsumerKey(NamedTuple):
    """
    Identifies a consumer instance for what concerns the broker settings.
    This is made of broker and consumer group but does not include the topic
    generally. This is because the topic is not necessarily known at the time
    we instantiate a Consumer object and pass the settings to the broker, but
    at subscription time.
    """

    cluster_name: str
    consumer_group: str

    def __str__(self) -> str:
        return f"{self.cluster_name}_{self.consumer_group}"


def get_kafka_consumer_cluster_options(
    consumer_key: ConsumerKey,
    override_params: Optional[MutableMapping[str, Any]] = None,
) -> MutableMapping[Any, Any]:
    consumer_options = settings.KAFKA_CONSUMERS.get(str(consumer_key), {})
    consumer_options.update(override_params or {})
    return _get_kafka_cluster_options(
        consumer_key.cluster_name,
        CONSUMERS_SECTION,
        only_bootstrap=True,
        override_params=consumer_options,
    )


def get_kafka_admin_cluster_options(
    cluster_name: str, override_params: Optional[MutableMapping[str, Any]] = None
) -> MutableMapping[Any, Any]:
    return _get_kafka_cluster_options(
        cluster_name, ADMIN_SECTION, only_bootstrap=True, override_params=override_params
    )
