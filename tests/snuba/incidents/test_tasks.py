from __future__ import absolute_import

import json
from copy import deepcopy
from uuid import uuid4

from confluent_kafka import Producer
from django.conf import settings
from django.test.utils import override_settings
from exam import fixture

from sentry.incidents.logic import create_alert_rule
from sentry.snuba.subscriptions import query_aggregation_to_snuba
from sentry.incidents.models import AlertRuleThresholdType, Incident, IncidentStatus, IncidentType
from sentry.incidents.tasks import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.snuba.models import QueryAggregations, QueryDatasets, QuerySubscription
from sentry.snuba.query_subscription_consumer import QuerySubscriptionConsumer, subscriber_registry

from sentry.testutils import TestCase


class HandleSnubaQueryUpdateTest(TestCase):
    def setUp(self):
        super(HandleSnubaQueryUpdateTest, self).setUp()
        self.override_settings_cm = override_settings(
            KAFKA_TOPICS={self.topic: {"cluster": "default", "topic": self.topic}}
        )
        self.override_settings_cm.__enter__()
        self.orig_registry = deepcopy(subscriber_registry)

    def tearDown(self):
        super(HandleSnubaQueryUpdateTest, self).tearDown()
        self.override_settings_cm.__exit__(None, None, None)
        subscriber_registry.clear()
        subscriber_registry.update(self.orig_registry)

    @fixture
    def subscription(self):
        subscription = QuerySubscription.objects.create(
            project=self.project,
            type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
            subscription_id="some_id",
            dataset=QueryDatasets.EVENTS.value,
            query="",
            aggregation=QueryAggregations.TOTAL.value,
            time_window=1,
            resolution=1,
        )
        return subscription

    @fixture
    def rule(self):
        rule = create_alert_rule(
            self.project,
            "some rule",
            AlertRuleThresholdType.ABOVE,
            query="",
            aggregation=QueryAggregations.TOTAL,
            time_window=1,
            alert_threshold=100,
            resolve_threshold=10,
            threshold_period=1,
        )
        rule.update(query_subscription=self.subscription)
        return rule

    @fixture
    def producer(self):
        cluster_name = settings.KAFKA_TOPICS[self.topic]["cluster"]
        conf = {
            "bootstrap.servers": settings.KAFKA_CLUSTERS[cluster_name]["bootstrap.servers"],
            "session.timeout.ms": 6000,
        }
        return Producer(conf)

    @fixture
    def topic(self):
        return uuid4().hex

    def test(self):
        # Full integration test to ensure that when a subscription receives an update
        # the `QuerySubscriptionConsumer` successfully retries the subscription and
        # calls the correct callback, which should result in an incident being created.

        callback = subscriber_registry[INCIDENTS_SNUBA_SUBSCRIPTION_TYPE]

        def exception_callback(*args, **kwargs):
            # We want to just error after the callback so that we can see the result of
            # processing. This means the offset won't be committed, but that's fine, we
            # can still check the results.
            callback(*args, **kwargs)
            raise KeyboardInterrupt()

        value_name = query_aggregation_to_snuba[QueryAggregations(self.subscription.aggregation)][2]

        subscriber_registry[INCIDENTS_SNUBA_SUBSCRIPTION_TYPE] = exception_callback
        message = {
            "version": 1,
            "payload": {
                "subscription_id": self.subscription.subscription_id,
                "values": {value_name: self.rule.alert_threshold + 1},
                "timestamp": 1235,
                "interval": 5,
                "partition": 50,
                "offset": 10,
            },
        }
        self.producer.produce(self.topic, json.dumps(message))
        self.producer.flush()

        def active_incident_exists():
            return Incident.objects.filter(
                type=IncidentType.ALERT_TRIGGERED.value,
                status=IncidentStatus.OPEN.value,
                alert_rule=self.rule,
            ).exists()

        consumer = QuerySubscriptionConsumer("hi", topic=self.topic)
        with self.assertChanges(active_incident_exists, before=False, after=True):
            consumer.run()
