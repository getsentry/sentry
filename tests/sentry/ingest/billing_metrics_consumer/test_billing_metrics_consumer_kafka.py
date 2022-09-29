"""
Things to test:
- read metric bucket, calculate correct outcomes (1+), write outcomes
- read metric bucket, calculate correct outcomes (0, list was empty for whatever reason), writes nothing
- read metric bucket, calculate correct outcomes (0, due to another metric), doesnt write anything
"""
from unittest import mock

from confluent_kafka import Consumer
from django.conf import settings
from django.test import override_settings

from sentry.conf.server import KAFKA_OUTCOMES, KAFKA_OUTCOMES_BILLING
from sentry.ingest.billing_metrics_consumer import MetricsBucket, get_metrics_billing_consumer
from sentry.sentry_metrics.indexer.strings import TRANSACTION_METRICS_NAMES
from sentry.utils import json


# @pytest.mark.parametrize("")  # TODO: Parametrize with different metric_ids, number of values
@mock.patch("sentry.ingest.billing_metrics_consumer.track_outcome")
def test_outcomes_consumed(track_outcome, kafka_producer, kafka_admin):
    # kafka_billing_cluster = "testing-billing-outcomes-cluster"
    # kafka_cluster_config = {
    #     kafka_billing_cluster: {
    #         "common": {"bootstrap.servers": "127.0.0.1:9092"},
    #         "producers": {},
    #         "consumers": {},
    #     }
    # }
    metrics_topic = "snuba-generic-metrics"

    admin = kafka_admin(settings)
    admin.delete_topic(metrics_topic)
    producer = kafka_producer(settings)

    with override_settings(
        KAFKA_CONSUMER_AUTO_CREATE_TOPICS=True,
        # KAFKA_OUTCOMES_BILLING=kafka_billing_topic,
        # KAFKA_CLUSTERS=ChainMap(kafka_cluster_config, settings.KAFKA_CLUSTERS),
        # KAFKA_TOPICS=ChainMap(
        #     {kafka_billing_topic: {"cluster": kafka_billing_cluster}},
        #     settings.KAFKA_TOPICS,
        # ),
    ):

        bucket: MetricsBucket = {
            "metric_id": TRANSACTION_METRICS_NAMES["d:transactions/duration@millisecond"],
            "org_id": 1,
            "project_id": 2,
            "timestamp": 123456,
            "value": [1.0, 2.0, 3.0],
        }

        producer = kafka_producer(settings)
        producer.produce(metrics_topic, json.dumps(bucket))
        producer.flush()

        metrics_consumer = get_metrics_billing_consumer(
            topic=metrics_topic,
            group_id="some_group_id",
            # auto_offset_reset="earliest",
            force_topic=None,
            force_cluster=None,
        )

        # # outcomes_consumer = Consumer(
        # #     {
        # #         "bootstrap.servers": "localhost:9092",
        # #         "group.id": "some_group_id",
        # #         "auto.offset.reset": "earliest",
        # #     }
        # # )
        # # outcomes_consumer.subscribe([KAFKA_OUTCOMES, KAFKA_OUTCOMES_BILLING])

        # Based on test_ingest_consumer_kafka.py
        for _ in range(100):
            print("metrics consumer run_once")
            metrics_consumer._run_once()
            print("outcome_consumer poll")
            # outcome_message = outcomes_consumer.poll(0)
            # if outcome_message:
            #     print(outcome_message.value())
            # print(track_outcome.mock_calls)
            # TODO: guarantee of getting message only once?
