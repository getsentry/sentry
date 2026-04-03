from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
import responses
from django.utils import timezone
from requests.exceptions import HTTPError

from sentry.api.serializers import serialize
from sentry.eventstream.types import EventStreamEventType
from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.endpoints.serializers.incident import IncidentSerializer
from sentry.incidents.models.incident import IncidentStatus
from sentry.incidents.typings.metric_detector import (
    AlertContext,
    MetricIssueContext,
    NotificationContext,
)
from sentry.models.rule import Rule
from sentry.plugins.sentry_webhooks.plugin import WebHooksPlugin
from sentry.rules.actions.notify_event_service import (
    NotifyEventServiceAction,
    send_incident_alert_notification,
)
from sentry.sentry_apps.tasks.sentry_apps import notify_sentry_app
from sentry.silo.base import SiloMode
from sentry.tasks.post_process import post_process_group
from sentry.testutils.cases import RuleTestCase, TestCase
from sentry.testutils.helpers.eventprocessing import write_event_to_cache
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba
from sentry.utils import json
from sentry.workflow_engine.migration_helpers.issue_alert_migration import IssueAlertMigrator
from sentry.workflow_engine.models import DataConditionGroupAction, WorkflowDataConditionGroup
from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType
from sentry.workflow_engine.typings.notification_action import ActionTarget
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest

pytestmark = [requires_snuba]


class NotifyEventServiceActionTest(RuleTestCase, BaseWorkflowTest):
    rule_cls = NotifyEventServiceAction

    def test_applies_correctly_for_plugins(self) -> None:
        event = self.get_event()

        plugin = MagicMock()
        plugin.is_enabled.return_value = True
        plugin.should_notify.return_value = True

        rule = self.get_rule(data={"service": "mail"})

        with patch("sentry.plugins.base.plugins.get") as get_plugin:
            get_plugin.return_value = plugin

            results = list(rule.after(event=event))

        assert len(results) == 1
        assert plugin.should_notify.call_count == 1
        assert results[0].callback is plugin.rule_notify


class NotifyEventServiceWebhookActionTest(NotifyEventServiceActionTest):
    def setUp(self) -> None:
        self.event = self.get_event()
        self.webhook = WebHooksPlugin()
        self.webhook.set_option(
            project=self.event.project, key="urls", value="http://my-fake-webhook.io"
        )
        self.webhook.set_option(project=self.event.project, key="enabled", value=True)

        self.rule_webhook_data = {
            "conditions": [
                {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}
            ],
            "actions": [
                {
                    "id": "sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
                    "service": "webhooks",
                    "uuid": uuid4().hex,
                }
            ],
        }

    @responses.activate
    def test_applies_correctly_for_legacy_webhooks_aci(self) -> None:
        responses.add(responses.POST, "http://my-fake-webhook.io")

        (
            error_workflow,
            error_detector,
            detector_workflow_error,
            condition_group,
        ) = self.create_detector_and_workflow(
            name_prefix="error",
            workflow_triggers=self.create_data_condition_group(),
            detector_type=ErrorGroupType.slug,
        )
        self.create_workflow_data_condition_group(
            workflow=error_workflow, condition_group=condition_group
        )
        # create webhook action
        action = self.create_action(
            config={
                "target_type": None,
                "target_display": None,
                "target_identifier": "webhooks",
            },
            type="webhook",
            data={},
        )
        self.create_data_condition_group_action(condition_group=condition_group, action=action)

        # create issue stream detector
        self.create_detector(
            project=self.project,
            type=IssueStreamGroupType.slug,
        )

        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(self.event),
                group_id=self.event.group_id,
                project_id=self.event.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        assert len(responses.calls) == 1

        payload = json.loads(responses.calls[0].request.body)
        assert payload["level"] == "error"
        assert payload["message"] == "こんにちは"
        assert payload["event"]["id"] == self.event.event_id
        assert payload["event"]["event_id"] == self.event.event_id
        assert payload["triggering_rules"] == ["error_detector"]

    @responses.activate
    def test_legacy_webhooks_uneven_dual_write_aci(self) -> None:
        """
        Test that if a dual written Rule has it's Action updated to email instead that we do not fire a response to the webhook
        """
        responses.add(method=responses.POST, url="http://my-fake-webhook.io", json={}, status=408)
        rule = Rule.objects.create(
            label="bad stuff happening",
            project=self.event.project,
            data=self.rule_webhook_data,
        )
        # dual write the rule to replicate current reality
        workflow = IssueAlertMigrator(rule, self.user.id).run()
        wdcg = WorkflowDataConditionGroup.objects.get(workflow=workflow)
        dcga = DataConditionGroupAction.objects.get(condition_group=wdcg.condition_group)
        action = dcga.action

        action_config = {
            "target_type": ActionTarget.USER.value,
            "target_display": None,
            "target_identifier": str(self.user.id),
        }
        action.update(config=action_config, type="email", data={})

        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(self.event),
                group_id=self.event.group_id,
                project_id=self.event.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        assert len(responses.calls) == 0

    @responses.activate
    @patch("sentry.plugins.sentry_webhooks.plugin.WebHooksPlugin.notify_users")
    def test_error_for_legacy_webhooks_dual_write_aci(self, mock_notify_users):
        responses.add(method=responses.POST, url="http://my-fake-webhook.io", json={}, status=408)
        mock_notify_users.side_effect = HTTPError("didn't work")
        rule = Rule.objects.create(
            label="bad stuff happening",
            project=self.event.project,
            data=self.rule_webhook_data,
        )
        # dual write the rule to replicate current reality
        IssueAlertMigrator(rule, self.user.id).run()

        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(self.event),
                group_id=self.event.group_id,
                project_id=self.event.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        assert len(responses.calls) == 0


class NotifyEventServiceSentryAppActionTest(NotifyEventServiceActionTest):
    def test_applies_correctly_for_sentry_apps(self) -> None:
        event = self.get_event()

        self.create_sentry_app(
            organization=event.organization, name="Test Application", is_alertable=True
        )

        rule = self.get_rule(data={"service": "test-application"})

        results = list(rule.after(event=event))

        assert len(results) == 1
        assert results[0].callback is notify_sentry_app

    def test_notify_sentry_app_and_plugin_with_same_slug(self) -> None:
        event = self.get_event()

        self.create_sentry_app(organization=event.organization, name="Notify", is_alertable=True)

        plugin = MagicMock()
        plugin.is_enabled.return_value = True
        plugin.should_notify.return_value = True

        rule = self.get_rule(data={"service": "notify"})

        with patch("sentry.plugins.base.plugins.get") as get_plugin:
            get_plugin.return_value = plugin

            results = list(rule.after(event=event))

        assert len(results) == 2
        assert plugin.should_notify.call_count == 1
        assert results[0].callback is notify_sentry_app
        assert results[1].callback is plugin.rule_notify

    def test_sentry_app_installed(self) -> None:
        event = self.get_event()

        self.create_sentry_app(
            organization=event.organization, name="Test Application", is_alertable=True
        )

        self.install = self.create_sentry_app_installation(
            slug="test-application", organization=event.organization
        )

        rule = self.get_rule(data={"service": "test-application"})

        results = rule.get_services()
        assert len(results) == 1

        self.install.date_deleted = timezone.now()
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.install.save()

        results = rule.get_services()
        assert len(results) == 0


class TestSendIncidentAlertNotification(TestCase):
    def setUp(self) -> None:
        self.project = self.create_project(organization=self.organization)
        self.sentry_app = self.create_sentry_app(organization=self.organization)
        self.alert_rule = self.create_alert_rule()
        self.incident = self.create_incident(alert_rule=self.alert_rule)
        self.alert_context = AlertContext.from_alert_rule_incident(self.alert_rule)
        self.metric_issue_context = MetricIssueContext.from_legacy_models(
            self.incident, IncidentStatus.CRITICAL, metric_value=100.0
        )
        self.incident_serialized_response = serialize(
            self.incident, serializer=IncidentSerializer()
        )
        self.notification_context = NotificationContext(
            id=1,
            sentry_app_id=self.sentry_app.id,
        )
        self.notification_uuid = str(uuid4())

    @patch("sentry.rules.actions.notify_event_service.send_metric_alert_webhook")
    def test_dispatches_task_with_correct_kwargs(self, mock_task: MagicMock) -> None:
        send_incident_alert_notification(
            notification_context=self.notification_context,
            alert_context=self.alert_context,
            metric_issue_context=self.metric_issue_context,
            incident_serialized_response=self.incident_serialized_response,
            organization=self.organization,
            project_id=self.project.id,
            notification_uuid=self.notification_uuid,
        )

        mock_task.delay.assert_called_once()
        call_kwargs = mock_task.delay.call_args.kwargs
        assert call_kwargs["sentry_app_id"] == self.sentry_app.id
        assert call_kwargs["new_status"] == IncidentStatus.CRITICAL.value
        assert call_kwargs["organization_id"] == self.organization.id
        assert call_kwargs["project_id"] == self.project.id
        assert call_kwargs["alert_id"] == self.alert_rule.id
        assert call_kwargs["notification_uuid"] == self.notification_uuid

        attachment = json.loads(call_kwargs["incident_attachment_json"])
        assert "metric_alert" in attachment
        assert "description_title" in attachment
        assert "description_text" in attachment
        assert "web_url" in attachment

    @patch("sentry.rules.actions.notify_event_service.send_metric_alert_webhook")
    def test_raises_when_sentry_app_id_is_none(self, mock_task: MagicMock) -> None:
        notification_context_no_app = NotificationContext(id=1, sentry_app_id=None)

        with pytest.raises(ValueError, match="Sentry app ID is required"):
            send_incident_alert_notification(
                notification_context=notification_context_no_app,
                alert_context=self.alert_context,
                metric_issue_context=self.metric_issue_context,
                incident_serialized_response=self.incident_serialized_response,
                organization=self.organization,
                project_id=self.project.id,
                notification_uuid=self.notification_uuid,
            )

        mock_task.delay.assert_not_called()

    @patch("sentry.utils.sentry_apps.webhooks.safe_urlopen")
    def test_end_to_end_sends_webhook(self, safe_urlopen: MagicMock) -> None:
        safe_urlopen.return_value = MagicMock(status_code=200, headers={})
        install = self.create_sentry_app_installation(
            organization=self.organization, slug=self.sentry_app.slug
        )

        with self.tasks():
            send_incident_alert_notification(
                notification_context=self.notification_context,
                alert_context=self.alert_context,
                metric_issue_context=self.metric_issue_context,
                incident_serialized_response=self.incident_serialized_response,
                organization=self.organization,
                project_id=self.project.id,
                notification_uuid=self.notification_uuid,
            )

        safe_urlopen.assert_called_once()
        _, call_kwargs = safe_urlopen.call_args
        body = json.loads(call_kwargs["data"])
        assert body["action"] == "critical"
        assert body["installation"]["uuid"] == install.uuid
