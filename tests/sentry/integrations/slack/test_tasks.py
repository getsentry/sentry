from __future__ import absolute_import

import responses

from uuid import uuid4

from sentry.utils import json
from sentry.utils.compat.mock import patch
from sentry.models import Integration, Rule
from sentry.incidents.models import (
    AlertRule,
    AlertRuleTriggerAction,
)
from sentry.integrations.slack.tasks import (
    find_channel_id_for_rule,
    find_channel_id_for_alert_rule,
    RedisRuleStatus,
)
from sentry.testutils.cases import TestCase


class SlackTasksTest(TestCase):
    def setUp(self):
        self.org = self.create_organization(name="foo", owner=self.user)
        self.project1 = self.create_project(organization=self.org)
        self.integration = Integration.objects.create(
            provider="slack",
            name="Team A",
            external_id="TXXXXXXX1",
            metadata={"access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )
        self.uuid = uuid4().hex
        self.integration.add_organization(self.org, self.user)

        channels = {"ok": "true", "channels": [{"name": "my-channel", "id": "chan-id"}]}

        responses.add(
            method=responses.GET,
            url="https://slack.com/api/channels.list",
            status=200,
            content_type="application/json",
            body=json.dumps(channels),
        )

    @responses.activate
    @patch.object(RedisRuleStatus, "set_value", return_value=None)
    def test_task_new_rule(self, mock_set_value):
        data = {
            "name": "New Rule",
            "environment": None,
            "project": self.project1,
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
        }

        with self.tasks():
            find_channel_id_for_rule(**data)

        rule = Rule.objects.get(project_id=self.project1.id)
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

    @responses.activate
    @patch.object(RedisRuleStatus, "set_value", return_value=None)
    def test_task_existing_rule(self, mock_set_value):
        action_data = {"id": "sentry.rules.actions.notify_event.NotifyEventAction"}
        condition_data = {"id": "sentry.rules.conditions.every_event.EveryEventCondition"}
        rule = Rule.objects.create(
            project=self.project1, data={"actions": [action_data], "conditions": [condition_data]}
        )

        data = {
            "name": "Test Rule",
            "environment": None,
            "project": self.project1,
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
        groups = {"ok": "true", "groups": [{"name": "my-private-channel", "id": "chan-id"}]}
        responses.add(
            method=responses.GET,
            url="https://slack.com/api/groups.list",
            status=200,
            content_type="application/json",
            body=json.dumps(groups),
        )

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
            "project": self.project1,
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

    @patch.object(RedisRuleStatus, "set_value", return_value=None)
    @patch(
        "sentry.integrations.slack.utils.get_channel_id_with_timeout",
        return_value=("#", "chan-id", False),
    )
    def test_task_new_alert_rule(self, mock_get_channel_id, mock_set_value):
        data = {
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
            "projects": [self.project1.slug],
            "name": "New Rule",
            "uuid": self.uuid,
            "organization_id": self.org.id,
        }

        with self.tasks():
            with self.feature(["organizations:incidents", "organizations:performance-view"]):
                find_channel_id_for_alert_rule(**data)

        rule = AlertRule.objects.get(name="New Rule")
        mock_set_value.assert_called_with("success", rule.id)
        mock_get_channel_id.assert_called_with(self.integration, "my-channel", 180)

        trigger_action = AlertRuleTriggerAction.objects.get(integration=self.integration.id)
        assert trigger_action.target_identifier == "chan-id"

    @patch.object(RedisRuleStatus, "set_value", return_value=None)
    @patch(
        "sentry.integrations.slack.utils.get_channel_id_with_timeout",
        return_value=("#", None, False),
    )
    def test_task_failed_id_lookup(self, mock_get_channel_id, mock_set_value):
        data = {
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
            "projects": [self.project1.slug],
            "name": "New Rule",
            "uuid": self.uuid,
            "organization_id": self.org.id,
        }

        with self.tasks():
            with self.feature(["organizations:incidents", "organizations:performance-view"]):
                find_channel_id_for_alert_rule(**data)

        assert not AlertRule.objects.filter(name="New Rule").exists()
        mock_set_value.assert_called_with("failed")
        mock_get_channel_id.assert_called_with(self.integration, "my-channel", 180)

    @patch.object(RedisRuleStatus, "set_value", return_value=None)
    @patch(
        "sentry.integrations.slack.utils.get_channel_id_with_timeout",
        return_value=("#", None, True),
    )
    def test_task_timeout_id_lookup(self, mock_get_channel_id, mock_set_value):
        data = {
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
            "projects": [self.project1.slug],
            "name": "New Rule",
            "uuid": self.uuid,
            "organization_id": self.org.id,
        }

        with self.tasks():
            with self.feature(["organizations:incidents", "organizations:performance-view"]):
                find_channel_id_for_alert_rule(**data)

        assert not AlertRule.objects.filter(name="New Rule").exists()
        mock_set_value.assert_called_with("failed")
        mock_get_channel_id.assert_called_with(self.integration, "my-channel", 180)
