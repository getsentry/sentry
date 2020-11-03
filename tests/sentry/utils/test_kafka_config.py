# -*- coding: utf-8 -*-

from __future__ import absolute_import

import os
import pytest
from django.test import override_settings
from django.conf import settings

from sentry.utils.kafka_config import (
    get_kafka_consumer_cluster_options,
    get_kafka_producer_cluster_options,
    get_kafka_admin_cluster_options,
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
                "security.protocol": "plain",  # legacy config
            }
        }
    ):
        cluster_options = get_kafka_producer_cluster_options("default")
        assert cluster_options["bootstrap.servers"] == "my.server:9092"
        assert cluster_options["security.protocol"] == "plain"


def test_get_kafka_consumer_cluster_options():
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
                "security.protocol": "plain",  # legacy config
            }
        }
    ):
        cluster_options = get_kafka_consumer_cluster_options("default")
        assert cluster_options["bootstrap.servers"] == "my.other.server:9092"
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
            get_kafka_consumer_cluster_options("default")


def test_bootstrap_format():
    with override_settings(
        KAFKA_CLUSTERS={"default": {"common": {"bootstrap.servers": ["I", "am", "a", "list"]}}}
    ):
        with pytest.raises(ValueError):
            get_kafka_consumer_cluster_options("default")

    # legacy should not raise an error
    with override_settings(
        KAFKA_CLUSTERS={"default": {"bootstrap.servers": ["I", "am", "a", "list"]}}
    ):
        cluster_options = get_kafka_consumer_cluster_options("default")
        assert cluster_options["bootstrap.servers"] == "I,am,a,list"
