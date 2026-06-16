import os

import pytest
from django.conf import settings
from django.test import override_settings

from sentry.conf.types.kafka_definition import Topic
from sentry.utils.kafka_config import (
    get_kafka_admin_cluster_options,
    get_kafka_consumer_cluster_options,
    get_kafka_producer_cluster_options,
)

settings.KAFKA_CLUSTERS["default"] = {
    "common": {"bootstrap.servers": os.environ.get("SENTRY_KAFKA_HOSTS", "127.0.0.1:9092")},
}


def test_get_kafka_producer_cluster_options() -> None:
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


def test_get_kafka_consumer_cluster_options() -> None:
    cluster_options = get_kafka_consumer_cluster_options("default")
    assert (
        cluster_options["bootstrap.servers"]
        == settings.KAFKA_CLUSTERS["default"]["common"]["bootstrap.servers"]
    )

    with override_settings(
        KAFKA_CLUSTERS={"default": {"consumers": {"bootstrap.servers": "my.other.server:9092"}}}
    ):
        cluster_options = get_kafka_consumer_cluster_options("default")
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
        cluster_options = get_kafka_consumer_cluster_options("default")
        assert cluster_options["bootstrap.servers"] == "my.legacy.server:9092"
        assert "security.protocol" not in cluster_options


def test_get_kafka_admin_cluster_options() -> None:
    cluster_options = get_kafka_admin_cluster_options("default")
    assert (
        cluster_options["bootstrap.servers"]
        == settings.KAFKA_CLUSTERS["default"]["common"]["bootstrap.servers"]
    )


def test_get_kafka_consumer_cluster_options_invalid() -> None:
    with override_settings(KAFKA_CLUSTERS={"default": {"common": {"invalid.setting": "value"}}}):
        with pytest.raises(ValueError):
            get_kafka_consumer_cluster_options("default")


def test_bootstrap_format() -> None:
    with override_settings(
        KAFKA_CLUSTERS={"default": {"common": {"bootstrap.servers": ["I", "am", "a", "list"]}}}
    ):
        with pytest.raises(ValueError):
            get_kafka_consumer_cluster_options("default")

    # legacy should not raise an error
    with override_settings(
        KAFKA_CLUSTERS={"default": {"bootstrap.servers": ["I", "am", "a", "list"]}}
    ):
        cluster_options = get_kafka_producer_cluster_options("default")
        assert cluster_options["bootstrap.servers"] == "I,am,a,list"

        cluster_options = get_kafka_consumer_cluster_options("default")
        assert cluster_options["bootstrap.servers"] == "I,am,a,list"


def test_legacy_custom_mix_customer() -> None:
    with override_settings(
        KAFKA_CLUSTERS={
            "default": {
                "common": {"bootstrap.servers": "new.server:9092", "security.protocol": "plain"},
                "bootstrap.servers": ["old.server:9092"],
            },
        }
    ):
        cluster_options = get_kafka_consumer_cluster_options("default")
        assert cluster_options["bootstrap.servers"] == "old.server:9092"
        assert "security.protocol" not in cluster_options


def test_consumer_options_topic_config_applied() -> None:
    with override_settings(
        KAFKA_TOPIC_CONSUMER_CONFIG={
            Topic.INGEST_TRANSACTIONS.value: {"max.poll.interval.ms": 60000}
        }
    ):
        cluster_options = get_kafka_consumer_cluster_options(
            "default", topic=Topic.INGEST_TRANSACTIONS
        )
        assert cluster_options["max.poll.interval.ms"] == 60000


def test_consumer_options_topic_config_absent_for_other_topics() -> None:
    with override_settings(
        KAFKA_TOPIC_CONSUMER_CONFIG={
            Topic.INGEST_TRANSACTIONS.value: {"max.poll.interval.ms": 60000}
        }
    ):
        # A topic not listed in the config gets nothing extra.
        cluster_options = get_kafka_consumer_cluster_options("default", topic=Topic.INGEST_EVENTS)
        assert "max.poll.interval.ms" not in cluster_options

        # No topic passed (e.g. the ops transfer script) also gets nothing.
        cluster_options = get_kafka_consumer_cluster_options("default")
        assert "max.poll.interval.ms" not in cluster_options


def test_consumer_options_explicit_override_params_win_over_topic_config() -> None:
    with override_settings(
        KAFKA_TOPIC_CONSUMER_CONFIG={
            Topic.INGEST_TRANSACTIONS.value: {"max.poll.interval.ms": 60000}
        }
    ):
        cluster_options = get_kafka_consumer_cluster_options(
            "default",
            override_params={"max.poll.interval.ms": 120000},
            topic=Topic.INGEST_TRANSACTIONS,
        )
        assert cluster_options["max.poll.interval.ms"] == 120000


def test_consumer_options_topic_config_supplies_value_without_cluster_entry() -> None:
    # Parity with the STREAM-1058 end state: the cluster carries no consumer config, yet the
    # transactions consumers still get max.poll.interval.ms from the topic-keyed path.
    with override_settings(
        KAFKA_CLUSTERS={
            "default": {"common": {"bootstrap.servers": "127.0.0.1:9092"}, "consumers": {}}
        },
        KAFKA_TOPIC_CONSUMER_CONFIG={
            Topic.TRANSACTIONS.value: {"max.poll.interval.ms": 60000},
            Topic.INGEST_TRANSACTIONS.value: {"max.poll.interval.ms": 60000},
            Topic.TRANSACTIONS_SUBSCRIPTIONS_RESULTS.value: {"max.poll.interval.ms": 60000},
        },
    ):
        for topic in (
            Topic.TRANSACTIONS,
            Topic.INGEST_TRANSACTIONS,
            Topic.TRANSACTIONS_SUBSCRIPTIONS_RESULTS,
        ):
            cluster_options = get_kafka_consumer_cluster_options("default", topic=topic)
            assert cluster_options["max.poll.interval.ms"] == 60000
