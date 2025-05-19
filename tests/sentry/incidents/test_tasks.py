from functools import cached_property
from unittest import mock
from unittest.mock import Mock

import pytest

from sentry.incidents.logic import (
    CRITICAL_TRIGGER_LABEL,
    create_alert_rule_trigger,
    create_alert_rule_trigger_action,
    create_incident_activity,
)
from sentry.incidents.models.alert_rule import AlertRuleTriggerAction
from sentry.incidents.models.incident import IncidentActivityType, IncidentStatus
from sentry.incidents.tasks import handle_trigger_action
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
            mock_handler.assert_called_once_with()
            mock_handler.return_value.fire.assert_called_once_with(
                action=self.action,
                incident=incident,
                project=self.project,
                new_status=IncidentStatus.CRITICAL,
                metric_value=metric_value,
                notification_uuid=str(activity.notification_uuid),
            )
