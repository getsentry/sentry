import json
import six
from datetime import datetime
import datetime
import pytz
from confluent_kafka import Producer
from django.conf import settings

from sentry.utils.dates import to_timestamp
from sentry.snuba.models import QuerySubscription
from sentry.snuba.query_subscription_consumer import QuerySubscriptionConsumer


def build_payload(subscription):
    return {
        "version": 1,
        "payload": {
            "subscription_id": subscription.subscription_id,
            "values": {"data": [{"count": 123}]},
            "timestamp": datetime.datetime.now().isoformat(),
        },
    }


def send_payload():
    payload = build_payload(QuerySubscription.objects.all().order_by("id")[:1].get())
    topic = settings.KAFKA_SNUBA_QUERY_SUBSCRIPTIONS
    cluster_name = settings.KAFKA_TOPICS[topic]["cluster"]
    conf = {
        "bootstrap.servers": settings.KAFKA_CLUSTERS[cluster_name]["bootstrap.servers"],
        "session.timeout.ms": 6000,
    }
    producer = Producer(conf)
    producer.produce(topic, json.dumps(payload))
    consumer = QuerySubscriptionConsumer("hi", topic=topic)
    consumer.run()


send_payload()
