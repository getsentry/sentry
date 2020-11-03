from __future__ import absolute_import
import six
from django.conf import settings

SUPPORTED_KAFKA_CONFIGURATION = (
    # Check https://github.com/edenhill/librdkafka/blob/master/CONFIGURATION.md
    # for the full list of available options
    "bootstrap.servers",
    "sasl.mechanism",
    "sasl.username",
    "sasl.password",
    "security.protocol",
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
    cluster_name, config_section, with_legacy=False, override_params=None
):
    options = {}
    custom_options = settings.KAFKA_CLUSTERS[cluster_name].get(config_section, {})
    common_options = settings.KAFKA_CLUSTERS[cluster_name].get(COMMON_SECTION, {})
    legacy_options = _get_legacy_kafka_cluster_options(cluster_name)
    if with_legacy and legacy_options:
        # we prefer these ones
        options.update(legacy_options)
    else:
        options.update(common_options)
        options.update(custom_options)
    # check key validity
    for configuration_key in options:
        if configuration_key not in SUPPORTED_KAFKA_CONFIGURATION:
            raise ValueError(
                "The `{configuration_key}` configuration key is not supported.".format(
                    configuration_key=configuration_key
                )
            )
    if not isinstance(options["bootstrap.servers"], six.string_types):
        raise ValueError("bootstrap.servers must be a comma separated string")
    if override_params:
        options.update(override_params)
    return options


def get_kafka_producer_cluster_options(cluster_name):
    return _get_kafka_cluster_options(cluster_name, PRODUCERS_SECTION, with_legacy=True)


def get_kafka_consumer_cluster_options(cluster_name, override_params=None):
    return _get_kafka_cluster_options(
        cluster_name, CONSUMERS_SECTION, override_params=override_params
    )


def get_kafka_admin_cluster_options(cluster_name, override_params=None):
    return _get_kafka_cluster_options(cluster_name, ADMIN_SECTION, override_params=override_params)
