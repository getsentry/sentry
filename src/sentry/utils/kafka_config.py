from __future__ import absolute_import
from django.conf import settings


def _get_legacy_kafka_cluster_options(cluster_name):
    options = settings.KAFKA_CLUSTERS[cluster_name]

    return {k: v for k, v in options.items() if k not in ("common", "producers", "consumers")}


def _get_kafka_cluster_options(cluster_name, config_section, with_legacy=False, override=None):
    options = {}
    if override:
        options.update(override)
    if with_legacy:
        legacy_options = _get_legacy_kafka_cluster_options(cluster_name)
        options.update(legacy_options)
    custom_options = settings.KAFKA_CLUSTERS[cluster_name].get(config_section, {})
    common_options = settings.KAFKA_CLUSTERS[cluster_name].get("common", {})
    options.update(custom_options)
    options.update(common_options)
    return options


def get_kafka_producer_cluster_options(cluster_name):
    return _get_kafka_cluster_options(cluster_name, "producers", with_legacy=True)


def get_kafka_consumer_cluster_options(cluster_name, override=None):
    return _get_kafka_cluster_options(cluster_name, "consumers", override=override)


def get_kafka_admin_cluster_options(cluster_name, override=None):
    return _get_kafka_cluster_options(cluster_name, "admin", override=override)
