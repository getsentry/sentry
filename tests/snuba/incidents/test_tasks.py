from copy import deepcopy
from uuid import uuid4

from confluent_kafka import Producer
from django.conf import settings
from django.core import mail
from django.test.utils import override_settings
from exam import fixture
from freezegun import freeze_time

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
    IncidentStatus,
    IncidentType,
    TriggerStatus,
)
from sentry.incidents.tasks import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.snuba.query_subscription_consumer import QuerySubscriptionConsumer, subscriber_registry
from sentry.testutils import TestCase
from sentry.utils import json


@freeze_time()
class HandleSnubaQueryUpdateTest(TestCase):
    def setUp(self):
        super().setUp()
        self.override_settings_cm = override_settings(
            KAFKA_TOPICS={self.topic: {"cluster": "default", "topic": self.topic}}
        )
        self.override_settings_cm.__enter__()
        self.orig_registry = deepcopy(subscriber_registry)

    def tearDown(self):
        super().tearDown()
        self.override_settings_cm.__exit__(None, None, None)
        subscriber_registry.clear()
        subscriber_registry.update(self.orig_registry)

    @fixture
    def subscription(self):
        return self.rule.snuba_query.subscriptions.get()

    @fixture
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

    @fixture
    def trigger(self):
        return self.rule.alertruletrigger_set.get()

    @fixture
    def action(self):
        return self.trigger.alertruletriggeraction_set.get()

    @fixture
    def producer(self):
        cluster_name = settings.KAFKA_TOPICS[self.topic]["cluster"]
        conf = {
            "bootstrap.servers": settings.KAFKA_CLUSTERS[cluster_name]["common"][
                "bootstrap.servers"
            ],
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

        message = {
            "version": 3,
            "payload": {
                "subscription_id": self.subscription.subscription_id,
                "result": {"data": [{"some_col": 101}]},
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

        consumer = QuerySubscriptionConsumer("hi", topic=self.topic)

        original_callback = subscriber_registry[INCIDENTS_SNUBA_SUBSCRIPTION_TYPE]

        def shutdown_callback(*args, **kwargs):
            # We want to just exit after the callback so that we can see the result of
            # processing.
            original_callback(*args, **kwargs)
            consumer.shutdown()

        subscriber_registry[INCIDENTS_SNUBA_SUBSCRIPTION_TYPE] = shutdown_callback

        with self.feature(["organizations:incidents", "organizations:performance-view"]):
            with self.assertChanges(
                lambda: active_incident().exists(), before=False, after=True
            ), self.tasks(), self.capture_on_commit_callbacks(execute=True):
                consumer.run()

        assert len(mail.outbox) == 1
        handler = EmailActionHandler(self.action, active_incident().get(), self.project)
        message = handler.build_message(
            generate_incident_trigger_email_context(
                handler.project,
                handler.incident,
                handler.action.alert_rule_trigger,
                TriggerStatus.ACTIVE,
                IncidentStatus.CRITICAL,
            ),
            TriggerStatus.ACTIVE,
            self.user.id,
        )

        out = mail.outbox[0]
        assert out.to == [self.user.email]
        assert out.subject == message.subject
        built_message = message.build(self.user.email)
        assert out.body == built_message.body
