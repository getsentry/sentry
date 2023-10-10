from copy import deepcopy
from functools import cached_property
from unittest import mock
from uuid import uuid4

from arroyo.utils import metrics
from confluent_kafka import Producer
from confluent_kafka.admin import AdminClient
from django.conf import settings
from django.core import mail
from django.test.utils import override_settings

from sentry.incidents.action_handlers import (
    EmailActionHandler,
    generate_incident_trigger_email_context,
)
from sentry.incidents.logic import (
    CRITICAL_TRIGGER_LABEL,
    create_alert_rule_trigger,
    create_alert_rule_trigger_action,
)
from sentry.incidents.models import (
    AlertRuleTriggerAction,
    Incident,
    IncidentActivity,
    IncidentStatus,
    IncidentType,
    TriggerStatus,
)
from sentry.incidents.tasks import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.runner.commands.run import DEFAULT_BLOCK_SIZE
from sentry.snuba.dataset import Dataset
from sentry.snuba.query_subscriptions.constants import topic_to_dataset
from sentry.snuba.query_subscriptions.consumer import subscriber_registry
from sentry.snuba.query_subscriptions.run import get_query_subscription_consumer
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.skips import requires_kafka
from sentry.utils import json, kafka_config
from sentry.utils.batching_kafka_consumer import create_topics

pytestmark = [requires_kafka]


@freeze_time()
class HandleSnubaQueryUpdateTest(TestCase):
    def setUp(self):
        super().setUp()
        self.override_settings_cm = override_settings(
            KAFKA_TOPICS={self.topic: {"cluster": "default"}}
        )
        self.override_settings_cm.__enter__()
        self.orig_registry = deepcopy(subscriber_registry)

        cluster_options = kafka_config.get_kafka_admin_cluster_options(
            "default", {"allow.auto.create.topics": "true"}
        )
        self.admin_client = AdminClient(cluster_options)

        kafka_cluster = kafka_config.get_topic_definition(self.topic)["cluster"]
        create_topics(kafka_cluster, [self.topic])

    def tearDown(self):
        super().tearDown()
        self.override_settings_cm.__exit__(None, None, None)
        subscriber_registry.clear()
        subscriber_registry.update(self.orig_registry)

        self.admin_client.delete_topics([self.topic])
        metrics._metrics_backend = None

    @cached_property
    def subscription(self):
        return self.rule.snuba_query.subscriptions.get()

    @cached_property
    def rule(self):
        with self.tasks():
            rule = self.create_alert_rule(
                name="some rule",
                query="",
                aggregate="count()",
                time_window=1,
                threshold_period=1,
                resolve_threshold=10,
            )
            trigger = create_alert_rule_trigger(rule, CRITICAL_TRIGGER_LABEL, 100)
            create_alert_rule_trigger_action(
                trigger,
                AlertRuleTriggerAction.Type.EMAIL,
                AlertRuleTriggerAction.TargetType.USER,
                str(self.user.id),
            )
            return rule

    @cached_property
    def trigger(self):
        return self.rule.alertruletrigger_set.get()

    @cached_property
    def action(self):
        return self.trigger.alertruletriggeraction_set.get()

    @cached_property
    def producer(self):
        cluster_name = kafka_config.get_topic_definition(self.topic)["cluster"]
        conf = {
            "bootstrap.servers": settings.KAFKA_CLUSTERS[cluster_name]["common"][
                "bootstrap.servers"
            ],
            "session.timeout.ms": 6000,
        }
        return Producer(conf)

    @cached_property
    def topic(self):
        return uuid4().hex

    def run_test(self, consumer):
        # Full integration test to ensure that when a subscription receives an update
        # the `QuerySubscriptionConsumer` successfully retries the subscription and
        # calls the correct callback, which should result in an incident being created.

        message = {
            "version": 3,
            "payload": {
                "subscription_id": self.subscription.subscription_id,
                "result": {
                    "data": [{"some_col": 101}],
                    "meta": [{"name": "count", "type": "UInt64"}],
                },
                "request": {
                    "some": "data",
                    "query": """MATCH (metrics_counters) SELECT sum(value) AS value BY
                            tags[3] WHERE org_id = 1 AND project_id IN tuple(1) AND metric_id = 16
                            AND tags[3] IN tuple(13, 4)""",
                },
                "entity": "metrics_counters",
                "timestamp": "2020-01-01T01:23:45.1234",
            },
        }
        self.producer.produce(self.topic, json.dumps(message))
        self.producer.flush()

        def active_incident():
            return Incident.objects.filter(
                type=IncidentType.ALERT_TRIGGERED.value, alert_rule=self.rule
            ).exclude(status=IncidentStatus.CLOSED.value)

        original_callback = subscriber_registry[INCIDENTS_SNUBA_SUBSCRIPTION_TYPE]

        def shutdown_callback(*args, **kwargs):
            # We want to just exit after the callback so that we can see the result of
            # processing.
            original_callback(*args, **kwargs)
            consumer.signal_shutdown()

        subscriber_registry[INCIDENTS_SNUBA_SUBSCRIPTION_TYPE] = shutdown_callback

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            assert not active_incident().exists()
            with self.tasks(), self.capture_on_commit_callbacks(execute=True):
                consumer.run()
            assert active_incident().exists()

        assert len(mail.outbox) == 1
        handler = EmailActionHandler(self.action, active_incident().get(), self.project)
        incident_activity = (
            IncidentActivity.objects.filter(incident=handler.incident).order_by("-id").first()
        )
        message_builder = handler.build_message(
            generate_incident_trigger_email_context(
                handler.project,
                handler.incident,
                handler.action.alert_rule_trigger,
                TriggerStatus.ACTIVE,
                IncidentStatus.CRITICAL,
                notification_uuid=str(incident_activity.notification_uuid),
            ),
            TriggerStatus.ACTIVE,
            self.user.id,
        )

        out = mail.outbox[0]
        assert isinstance(out, mail.EmailMultiAlternatives)
        assert out.to == [self.user.email]
        assert out.subject == message_builder.subject
        built_message = message_builder.build(self.user.email)
        assert out.body == built_message.body

    def test_arroyo(self):
        with mock.patch.dict(topic_to_dataset, {self.topic: Dataset.Metrics}):
            consumer = get_query_subscription_consumer(
                self.topic,
                "hi",
                True,
                "earliest",
                1,
                1,
                1,
                DEFAULT_BLOCK_SIZE,
                DEFAULT_BLOCK_SIZE,
                multi_proc=False,
            )
            self.run_test(consumer)
