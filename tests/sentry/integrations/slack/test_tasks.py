from functools import cached_property
from unittest.mock import patch
from urllib.parse import parse_qs
from uuid import uuid4

import responses

from sentry.incidents.models import AlertRule, AlertRuleTriggerAction
from sentry.integrations.slack.utils import SLACK_RATE_LIMITED_MESSAGE, RedisRuleStatus
from sentry.models import Rule
from sentry.receivers.rules import DEFAULT_RULE_LABEL
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.tasks.integrations.slack import (
    find_channel_id_for_alert_rule,
    find_channel_id_for_rule,
    post_message,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import install_slack
from sentry.testutils.silo import region_silo_test
from sentry.utils import json


@region_silo_test(stable=True)
class SlackTasksTest(TestCase):
    def setUp(self):
        self.integration = install_slack(self.organization)
        self.uuid = uuid4().hex

        channels = {"ok": "true", "channels": [{"name": "my-channel", "id": "chan-id"}]}

        responses.add(
            method=responses.GET,
            url="https://slack.com/api/conversations.list",
            status=200,
            content_type="application/json",
            body=json.dumps(channels),
        )

    @cached_property
    def metric_alert_data(self):
        return {
            "aggregate": "count()",
            "query": "",
            "timeWindow": "300",
            "resolveThreshold": 100,
            "thresholdType": 0,
            "triggers": [
                {
                    "label": "critical",
                    "alertThreshold": 200,
                    "actions": [
                        {
                            "type": "slack",
                            "targetIdentifier": "my-channel",
                            "targetType": "specific",
                            "integration": self.integration.id,
                        }
                    ],
                },
            ],
            "projects": [self.project.slug],
            "owner": self.user.id,
            "name": "New Rule",
            "organization_id": self.organization.id,
        }

    @responses.activate
    @patch.object(RedisRuleStatus, "set_value", return_value=None)
    def test_task_new_rule(self, mock_set_value):
        data = {
            "name": "New Rule",
            "environment": None,
            "project": self.project,
            "action_match": "all",
            "filter_match": "all",
            "conditions": [
                {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"}
            ],
            "actions": [
                {
                    "channel": "#my-channel",
                    "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                    "name": "Send a notification to the funinthesun Slack workspace to #secrets and show tags [] in notification",
                    "tags": "",
                    "workspace": self.integration.id,
                }
            ],
            "frequency": 5,
            "uuid": self.uuid,
            "user_id": self.user.id,
        }

        with self.tasks():
            find_channel_id_for_rule(**data)

        rule = Rule.objects.exclude(label=DEFAULT_RULE_LABEL).get(project_id=self.project.id)
        mock_set_value.assert_called_with("success", rule.id)
        assert rule.label == "New Rule"
        # check that the channel_id got added
        assert rule.data["actions"] == [
            {
                "channel": "#my-channel",
                "channel_id": "chan-id",
                "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                "name": "Send a notification to the funinthesun Slack workspace to #secrets and show tags [] in notification",
                "tags": "",
                "workspace": self.integration.id,
            }
        ]
        assert rule.created_by == self.user

    @responses.activate
    @patch.object(RedisRuleStatus, "set_value", return_value=None)
    def test_task_existing_rule(self, mock_set_value):
        action_data = {"id": "sentry.rules.actions.notify_event.NotifyEventAction"}
        condition_data = {"id": "sentry.rules.conditions.every_event.EveryEventCondition"}
        rule = Rule.objects.create(
            project=self.project, data={"actions": [action_data], "conditions": [condition_data]}
        )

        data = {
            "name": "Test Rule",
            "environment": None,
            "project": self.project,
            "action_match": "all",
            "filter_match": "all",
            "conditions": [condition_data],
            "actions": [
                {
                    "channel": "#my-channel",
                    "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                    "name": "Send a notification to the funinthesun Slack workspace to #secrets and show tags [] in notification",
                    "tags": "",
                    "workspace": self.integration.id,
                }
            ],
            "frequency": 5,
            "uuid": self.uuid,
            "rule_id": rule.id,
        }

        with self.tasks():
            find_channel_id_for_rule(**data)

        updated_rule = Rule.objects.get(id=rule.id)
        mock_set_value.assert_called_with("success", rule.id)
        assert updated_rule.label == "Test Rule"
        # check that the channel_id got added
        assert updated_rule.data["actions"] == [
            {
                "channel": "#my-channel",
                "channel_id": "chan-id",
                "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                "name": "Send a notification to the funinthesun Slack workspace to #secrets and show tags [] in notification",
                "tags": "",
                "workspace": self.integration.id,
            }
        ]

    @responses.activate
    @patch.object(RedisRuleStatus, "set_value", return_value=None)
    def test_task_failed_channel_id_lookup(self, mock_set_value):
        members = {"ok": "true", "members": [{"name": "morty", "id": "morty-id"}]}
        responses.add(
            method=responses.GET,
            url="https://slack.com/api/users.list",
            status=200,
            content_type="application/json",
            body=json.dumps(members),
        )

        data = {
            "name": "Test Rule",
            "environment": None,
            "project": self.project,
            "action_match": "all",
            "filter_match": "all",
            "conditions": [{"id": "sentry.rules.conditions.every_event.EveryEventCondition"}],
            "actions": [
                {
                    "channel": "#some-channel",
                    "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                    "name": "Send a notification to the funinthesun Slack workspace to #secrets and show tags [] in notification",
                    "tags": "",
                    "workspace": self.integration.id,
                }
            ],
            "frequency": 5,
            "uuid": self.uuid,
        }

        with self.tasks():
            find_channel_id_for_rule(**data)

        mock_set_value.assert_called_with("failed")

    @responses.activate
    @patch.object(RedisRuleStatus, "set_value", return_value=None)
    def test_task_rate_limited_channel_id_lookup(self, mock_set_value):
        """Should set the correct error value when rate limited"""
        responses.add(
            method=responses.GET,
            url="https://slack.com/api/users.list",
            status=429,
            content_type="application/json",
            body=json.dumps({"ok": "true", "error": "ratelimited"}),
        )

        data = {
            "name": "Test Rule",
            "environment": None,
            "project": self.project,
            "action_match": "all",
            "filter_match": "all",
            "conditions": [{"id": "sentry.rules.conditions.every_event.EveryEventCondition"}],
            "actions": [
                {
                    "channel": "@user",
                    "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                    "name": "Send a notification to the funinthesun Slack workspace to #secrets and show tags [] in notification",
                    "tags": "",
                    "workspace": self.integration.id,
                }
            ],
            "frequency": 5,
            "uuid": self.uuid,
        }

        with self.tasks():
            find_channel_id_for_rule(**data)

        mock_set_value.assert_called_with("failed", None, SLACK_RATE_LIMITED_MESSAGE)

    @patch.object(RedisRuleStatus, "set_value", return_value=None)
    @patch(
        "sentry.integrations.slack.utils.channel.get_channel_id_with_timeout",
        return_value=("#", "chan-id", False),
    )
    def test_task_new_alert_rule(self, mock_get_channel_id, mock_set_value):
        alert_rule_data = self.metric_alert_data

        data = {
            "data": alert_rule_data,
            "uuid": self.uuid,
            "organization_id": self.organization.id,
            "user_id": self.user.id,
        }

        with self.tasks():
            with self.feature(["organizations:incidents"]):
                find_channel_id_for_alert_rule(**data)

        rule = AlertRule.objects.get(name="New Rule")
        assert rule.created_by.id == self.user.id
        mock_set_value.assert_called_with("success", rule.id)
        mock_get_channel_id.assert_called_with(
            integration_service._serialize_integration(self.integration), "my-channel", 180
        )

        trigger_action = AlertRuleTriggerAction.objects.get(integration=self.integration.id)
        assert trigger_action.target_identifier == "chan-id"

    @patch.object(RedisRuleStatus, "set_value", return_value=None)
    @patch(
        "sentry.integrations.slack.utils.channel.get_channel_id_with_timeout",
        return_value=("#", None, False),
    )
    def test_task_failed_id_lookup(self, mock_get_channel_id, mock_set_value):
        alert_rule_data = self.metric_alert_data

        data = {
            "data": alert_rule_data,
            "uuid": self.uuid,
            "organization_id": self.organization.id,
        }

        with self.tasks():
            with self.feature(["organizations:incidents"]):
                find_channel_id_for_alert_rule(**data)

        assert not AlertRule.objects.filter(name="New Rule").exists()
        mock_set_value.assert_called_with("failed")
        mock_get_channel_id.assert_called_with(
            integration_service._serialize_integration(self.integration), "my-channel", 180
        )

    @patch.object(RedisRuleStatus, "set_value", return_value=None)
    @patch(
        "sentry.integrations.slack.utils.channel.get_channel_id_with_timeout",
        return_value=("#", None, True),
    )
    def test_task_timeout_id_lookup(self, mock_get_channel_id, mock_set_value):
        alert_rule_data = self.metric_alert_data

        data = {
            "data": alert_rule_data,
            "uuid": self.uuid,
            "organization_id": self.organization.id,
        }

        with self.tasks():
            with self.feature(["organizations:incidents"]):
                find_channel_id_for_alert_rule(**data)

        assert not AlertRule.objects.filter(name="New Rule").exists()
        mock_set_value.assert_called_with("failed")
        mock_get_channel_id.assert_called_with(
            integration_service._serialize_integration(self.integration), "my-channel", 180
        )

    @patch.object(RedisRuleStatus, "set_value", return_value=None)
    @patch(
        "sentry.integrations.slack.utils.channel.get_channel_id_with_timeout",
        return_value=("#", "chan-id", False),
    )
    def test_task_existing_metric_alert(self, mock_get_channel_id, mock_set_value):
        alert_rule_data = self.metric_alert_data
        alert_rule = self.create_alert_rule(
            organization=self.organization, projects=[self.project], name="New Rule", user=self.user
        )

        data = {
            "data": alert_rule_data,
            "uuid": self.uuid,
            "organization_id": self.organization.id,
            "alert_rule_id": alert_rule.id,
        }

        with self.tasks():
            with self.feature(["organizations:incidents"]):
                find_channel_id_for_alert_rule(**data)

        rule = AlertRule.objects.get(name="New Rule")
        mock_set_value.assert_called_with("success", rule.id)
        mock_get_channel_id.assert_called_with(
            integration_service._serialize_integration(self.integration), "my-channel", 180
        )

        trigger_action = AlertRuleTriggerAction.objects.get(integration=self.integration.id)
        assert trigger_action.target_identifier == "chan-id"
        assert AlertRule.objects.get(id=alert_rule.id)

    @responses.activate
    def test_post_message_success(self):
        responses.add(
            responses.POST,
            "https://slack.com/api/chat.postMessage",
            json={"ok": True},
            status=200,
        )
        with self.tasks():
            post_message.apply_async(
                kwargs={
                    "payload": {"key": ["val"]},
                    "log_error_message": "my_message",
                    "log_params": {"log_key": "log_value"},
                }
            )
        data = parse_qs(responses.calls[0].request.body)
        assert data == {"key": ["val"]}

    @responses.activate
    def test_post_message_failure(self):
        responses.add(
            responses.POST,
            "https://slack.com/api/chat.postMessage",
            json={"ok": False, "error": "my_error"},
            status=200,
        )
        with self.tasks():
            post_message.apply_async(
                kwargs={
                    "payload": {"key": ["val"]},
                    "log_error_message": "my_message",
                    "log_params": {"log_key": "log_value"},
                }
            )
        data = parse_qs(responses.calls[0].request.body)
        assert data == {"key": ["val"]}
