import os

import pytest
from django.conf import settings
from django.test import override_settings

from sentry.utils.kafka_config import (
    ConsumerKey,
    get_kafka_admin_cluster_options,
    get_kafka_consumer_cluster_options,
    get_kafka_producer_cluster_options,
)

settings.KAFKA_CLUSTERS["default"] = {
    "common": {"bootstrap.servers": os.environ.get("SENTRY_KAFKA_HOSTS", "localhost:9092")},
}


def test_get_kafka_producer_cluster_options():
    cluster_options = get_kafka_producer_cluster_options("default")
    assert (
        cluster_options["bootstrap.servers"]
        == settings.KAFKA_CLUSTERS["default"]["common"]["bootstrap.servers"]
    )

    with override_settings(
        KAFKA_CLUSTERS={"default": {"producers": {"bootstrap.servers": "my.server:9092"}}}
    ):
        cluster_options = get_kafka_producer_cluster_options("default")
        assert cluster_options["bootstrap.servers"] == "my.server:9092"

    with override_settings(
        KAFKA_CLUSTERS={
            "default": {
                "producers": {"bootstrap.servers": "my.server:9092"},
                "bootstrap.servers": "my.legacy.server:9092",
                "security.protocol": "plain",  # legacy config
            }
        }
    ):
        cluster_options = get_kafka_producer_cluster_options("default")
        assert cluster_options["bootstrap.servers"] == "my.legacy.server:9092"
        assert cluster_options["security.protocol"] == "plain"


def test_get_kafka_consumer_cluster_options():
    cluster_options = get_kafka_consumer_cluster_options(ConsumerKey("default", "group"))
    assert (
        cluster_options["bootstrap.servers"]
        == settings.KAFKA_CLUSTERS["default"]["common"]["bootstrap.servers"]
    )

    with override_settings(
        KAFKA_CLUSTERS={"default": {"consumers": {"bootstrap.servers": "my.other.server:9092"}}}
    ):
        cluster_options = get_kafka_consumer_cluster_options(ConsumerKey("default", "group"))
        assert cluster_options["bootstrap.servers"] == "my.other.server:9092"

    with override_settings(
        KAFKA_CLUSTERS={
            "default": {
                "consumers": {"bootstrap.servers": "my.other.server:9092"},
                # legacy config:
                "security.protocol": "plain",
                "bootstrap.servers": "my.legacy.server:9092",
            }
        }
    ):
        cluster_options = get_kafka_consumer_cluster_options(ConsumerKey("default", "group"))
        assert cluster_options["bootstrap.servers"] == "my.legacy.server:9092"
        assert "security.protocol" not in cluster_options


def test_get_kafka_admin_cluster_options():
    cluster_options = get_kafka_admin_cluster_options("default")
    assert (
        cluster_options["bootstrap.servers"]
        == settings.KAFKA_CLUSTERS["default"]["common"]["bootstrap.servers"]
    )


def test_get_kafka_consumer_cluster_options_invalid():
    with override_settings(KAFKA_CLUSTERS={"default": {"common": {"invalid.setting": "value"}}}):
        with pytest.raises(ValueError):
            get_kafka_consumer_cluster_options(ConsumerKey("default", "group"))


def test_bootstrap_format():
    with override_settings(
        KAFKA_CLUSTERS={"default": {"common": {"bootstrap.servers": ["I", "am", "a", "list"]}}}
    ):
        with pytest.raises(ValueError):
            get_kafka_consumer_cluster_options(ConsumerKey("default", "group"))

    # legacy should not raise an error
    with override_settings(
        KAFKA_CLUSTERS={"default": {"bootstrap.servers": ["I", "am", "a", "list"]}}
    ):
        cluster_options = get_kafka_producer_cluster_options("default")
        assert cluster_options["bootstrap.servers"] == "I,am,a,list"

        cluster_options = get_kafka_consumer_cluster_options(ConsumerKey("default", "group"))
        assert cluster_options["bootstrap.servers"] == "I,am,a,list"


def test_legacy_custom_mix_customer():
    with override_settings(
        KAFKA_CLUSTERS={
            "default": {
                "common": {"bootstrap.servers": "new.server:9092", "security.protocol": "plain"},
                "bootstrap.servers": ["old.server:9092"],
            },
        }
    ):
        cluster_options = get_kafka_consumer_cluster_options(ConsumerKey("default", "group"))
        assert cluster_options["bootstrap.servers"] == "old.server:9092"
        assert "security.protocol" not in cluster_options


def test_consumer_specific_settings():
    with override_settings(
        KAFKA_CONSUMERS={
            "default_group": {
                "session.timeout.ms": 10000,
            }
        }
    ):
        consumer_options = get_kafka_consumer_cluster_options(ConsumerKey("default", "group2"))
        assert "session.timeout.ms" not in consumer_options

        consumer_options = get_kafka_consumer_cluster_options(ConsumerKey("default", "group"))
        assert consumer_options["session.timeout.ms"] == 10000

        consumer_options = get_kafka_consumer_cluster_options(
            ConsumerKey("default", "group"), override_params={"session.timeout.ms": 10}
        )
        assert consumer_options["session.timeout.ms"] == 10
