"""
Things to test:
- read metric bucket, calculate correct outcomes (1+), write outcomes
- read metric bucket, calculate correct outcomes (0, list was empty for whatever reason), writes nothing
- read metric bucket, calculate correct outcomes (0, due to another metric), doesnt write anything
"""
from typing import ChainMap

from django.conf import settings
from django.test import override_settings

from sentry.ingest.billing_metrics_consumer import get_metrics_billing_consumer


def test_supertests(kafka_producer, kafka_admin):
    kafka_billing_topic = "testing-billing-outcomes-topic"
    kafka_billing_cluster = "testing-billing-outcomes-cluster"
    kafka_cluster_config = {
        kafka_billing_cluster: {
            "common": {"bootstrap.servers": "127.0.0.1:9092"},
            "producers": {},
            "consumers": {},
        }
    }

    print("running the test...")

    with override_settings(
        KAFKA_CONSUMER_AUTO_CREATE_TOPICS=True,
        KAFKA_OUTCOMES_BILLING=kafka_billing_topic,
        KAFKA_CLUSTERS=ChainMap(kafka_cluster_config, settings.KAFKA_CLUSTERS),
        KAFKA_TOPICS=ChainMap(
            {kafka_billing_topic: {"cluster": kafka_billing_cluster}},
            settings.KAFKA_TOPICS,
        ),
    ):
        # import ipdb

        # ipdb.set_trace(context=21)
        # consumer = get_metrics_billing_consumer(
        #     topic="topic",
        #     group_id="group_id",
        #     auto_offset_reset="latest",
        #     force_topic=None,
        #     force_cluster=None,
        # )
        print(settings.KAFKA_OUTCOMES_BILLING)
        print(settings.KAFKA_TOPICS[kafka_billing_topic])
        print(settings.KAFKA_CLUSTERS[kafka_billing_cluster])

    admin = kafka_admin(settings)
    producer = kafka_producer(settings)
