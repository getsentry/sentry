from datetime import timedelta
from functools import cached_property
from unittest import mock
from unittest.mock import Mock, call, patch

import pytest
from django.utils import timezone

from sentry.incidents.logic import (
    CRITICAL_TRIGGER_LABEL,
    create_alert_rule_trigger,
    create_alert_rule_trigger_action,
    create_incident_activity,
)
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.incidents.models.incident import IncidentActivityType, IncidentStatus
from sentry.incidents.tasks import handle_subscription_metrics_logger, handle_trigger_action
from sentry.incidents.utils.constants import SUBSCRIPTION_METRICS_LOGGER
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.alert_rule import TemporaryAlertRuleTriggerActionRegistry
from sentry.testutils.skips import requires_kafka, requires_snuba

pytestmark = [pytest.mark.sentry_metrics, requires_snuba, requires_kafka]


class HandleTriggerActionTest(TestCase):
    @pytest.fixture(autouse=True)
    def _setup_metric_patch(self):
        with mock.patch("sentry.incidents.tasks.metrics") as self.metrics:
            yield

    @cached_property
    def alert_rule(self):
        return self.create_alert_rule()

    @cached_property
    def trigger(self):
        return create_alert_rule_trigger(self.alert_rule, CRITICAL_TRIGGER_LABEL, 100)

    @cached_property
    def action(self):
        return create_alert_rule_trigger_action(
            self.trigger, AlertRuleTriggerAction.Type.EMAIL, AlertRuleTriggerAction.TargetType.USER
        )

    def test_missing_trigger_action(self):
        with self.tasks():
            handle_trigger_action.delay(
                1000, 1001, self.project.id, "hello", IncidentStatus.CRITICAL.value
            )
        self.metrics.incr.assert_called_once_with(
            "incidents.alert_rules.action.skipping_missing_action"
        )

    def test_missing_incident(self):
        with self.tasks():
            handle_trigger_action.delay(
                self.action.id, 1001, self.project.id, "hello", IncidentStatus.CRITICAL.value
            )
        self.metrics.incr.assert_called_once_with(
            "incidents.alert_rules.action.skipping_missing_incident"
        )

    def test_missing_project(self):
        incident = self.create_incident()
        with self.tasks():
            handle_trigger_action.delay(
                self.action.id, incident.id, 1002, "hello", IncidentStatus.CRITICAL.value
            )
        self.metrics.incr.assert_called_once_with(
            "incidents.alert_rules.action.skipping_missing_project"
        )

    def test(self):
        with TemporaryAlertRuleTriggerActionRegistry.registry_patched():
            mock_handler = Mock()
            AlertRuleTriggerAction.register_type("email", AlertRuleTriggerAction.Type.EMAIL, [])(
                mock_handler
            )
            incident = self.create_incident()
            activity = create_incident_activity(
                incident,
                IncidentActivityType.STATUS_CHANGE,
                value=IncidentStatus.CRITICAL.value,
            )
            metric_value = 1234
            with self.tasks():
                handle_trigger_action.delay(
                    self.action.id,
                    incident.id,
                    self.project.id,
                    "fire",
                    IncidentStatus.CRITICAL.value,
                    metric_value=metric_value,
                )
            mock_handler.assert_called_once_with(self.action, incident, self.project)
            mock_handler.return_value.fire.assert_called_once_with(
                metric_value, IncidentStatus.CRITICAL, str(activity.notification_uuid)
            )


class TestHandleSubscriptionMetricsLogger(TestCase):
    @cached_property
    def subscription(self):
        snuba_query = create_snuba_query(
            SnubaQuery.Type.CRASH_RATE,
            Dataset.Metrics,
            "hello",
            "count()",
            timedelta(minutes=1),
            timedelta(minutes=1),
            None,
        )
        return create_snuba_subscription(self.project, SUBSCRIPTION_METRICS_LOGGER, snuba_query)

    def build_subscription_update(self):
        timestamp = timezone.now().replace(microsecond=0)
        data = {
            "count": 100,
            "crashed": 2.0,
        }
        values = {"data": [data]}
        return {
            "subscription_id": self.subscription.subscription_id,
            "values": values,
            "timestamp": timestamp,
            "interval": 1,
            "partition": 1,
            "offset": 1,
        }

    def test(self):
        with patch("sentry.incidents.tasks.logger") as logger:
            subscription_update = self.build_subscription_update()
            handle_subscription_metrics_logger(subscription_update, self.subscription)
            assert logger.info.call_args_list == [
                call(
                    "handle_subscription_metrics_logger.message",
                    extra={
                        "subscription_id": self.subscription.id,
                        "dataset": self.subscription.snuba_query.dataset,
                        "snuba_subscription_id": self.subscription.subscription_id,
                        "result": subscription_update,
                        "aggregation_value": 98.0,
                    },
                )
            ]
