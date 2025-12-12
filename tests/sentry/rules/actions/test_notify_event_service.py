from unittest.mock import MagicMock, patch
from uuid import uuid4

import responses
from django.utils import timezone

from sentry.eventstream.types import EventStreamEventType
from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.rule import Rule
from sentry.plugins.sentry_webhooks.plugin import WebHooksPlugin
from sentry.rules.actions.notify_event_service import NotifyEventServiceAction
from sentry.sentry_apps.tasks.sentry_apps import notify_sentry_app
from sentry.silo.base import SiloMode
from sentry.tasks.post_process import post_process_group
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.helpers.eventprocessing import write_event_to_cache
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba
from sentry.utils import json
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

    @responses.activate
    def test_applies_correctly_for_legacy_webhooks(self) -> None:
        self.event = self.get_event()
        webhook = WebHooksPlugin()
        responses.add(responses.POST, "http://my-fake-webhook.io")
        webhook.set_option(project=self.project, key="urls", value="http://my-fake-webhook.io")
        webhook.set_option(project=self.project, key="enabled", value=True)

        Rule.objects.create(
            project=self.event.project,
            data={
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
            },
        )

        # results = list(rule.after(event=event))
        # assert len(results) == 1
        # webhook.rule_notify(event=event, futures=results)

        with self.tasks():
            post_process_group(
                is_new=True,
                is_regression=False,
                is_new_group_environment=False,
                cache_key=write_event_to_cache(self.event),
                group_id=self.event.group_id,
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        # futures = [RuleFuture(rule, {})]
        # webhook.rule_notify(self.event, futures)

        assert len(responses.calls) == 1

        payload = json.loads(responses.calls[0].request.body)
        assert payload["level"] == "error"
        assert payload["message"] == "こんにちは"
        assert payload["event"]["id"] == self.event.event_id
        assert payload["event"]["event_id"] == self.event.event_id
        # assert payload["triggering_rules"] == ['Send a notification via {service}']

    @responses.activate
    def test_applies_correctly_for_legacy_webhooks_aci(self):
        self.event = self.get_event()
        webhook = WebHooksPlugin()
        responses.add(responses.POST, "http://my-fake-webhook.io")
        webhook.set_option(project=self.project, key="urls", value="http://my-fake-webhook.io")
        webhook.set_option(project=self.project, key="enabled", value=True)

        # create ACI objects
        (
            self.error_workflow,
            self.error_detector,
            self.detector_workflow_error,
            self.condition_group,
        ) = self.create_detector_and_workflow(
            name_prefix="error",
            workflow_triggers=self.create_data_condition_group(),
            detector_type=ErrorGroupType.slug,
        )
        self.create_workflow_data_condition_group(
            workflow=self.error_workflow, condition_group=self.condition_group
        )
        self.issue_owners_action_config = {
            "target_type": ActionTarget.ISSUE_OWNERS.value,
            "target_display": None,
            "target_identifier": None,
        }
        self.issue_stream_detector = self.create_detector(
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
                project_id=self.project.id,
                eventstream_type=EventStreamEventType.Error.value,
            )

        assert len(responses.calls) == 1

        payload = json.loads(responses.calls[0].request.body)
        assert payload["level"] == "error"
        assert payload["message"] == "こんにちは"
        assert payload["event"]["id"] == self.event.event_id
        assert payload["event"]["event_id"] == self.event.event_id
        # assert payload["triggering_rules"] == ['Send a notification via {service}']

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
