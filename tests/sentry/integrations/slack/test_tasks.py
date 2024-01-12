from unittest.mock import patch
from urllib.parse import parse_qs
from uuid import uuid4

import pytest
import responses

from sentry.incidents.models import AlertRule, AlertRuleTriggerAction
from sentry.integrations.slack.utils import RedisRuleStatus
from sentry.models.rule import Rule
from sentry.receivers.rules import DEFAULT_RULE_LABEL, DEFAULT_RULE_LABEL_NEW
from sentry.services.hybrid_cloud.integration.serial import serialize_integration
from sentry.tasks.integrations.slack import (
    find_channel_id_for_alert_rule,
    find_channel_id_for_rule,
    post_message,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import install_slack
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.utils import json

pytestmark = [requires_snuba]


@region_silo_test
class SlackTasksTest(TestCase):
    def setUp(self):
        self.integration = install_slack(self.organization)
        self.uuid = uuid4().hex

    @pytest.fixture(autouse=True)
    def setup_responses(self):
        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.scheduleMessage",
            status=200,
            content_type="application/json",
            body=json.dumps(
                {"ok": "true", "channel": "chan-id", "scheduled_message_id": "Q1298393284"}
            ),
        )
        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.deleteScheduledMessage",
            status=200,
            content_type="application/json",
            body=json.dumps({"ok": True}),
        )
        with responses.mock:
            yield

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

        rule = Rule.objects.exclude(label__in=[DEFAULT_RULE_LABEL, DEFAULT_RULE_LABEL_NEW]).get(
            project_id=self.project.id
        )
        mock_set_value.assert_called_with("success", rule.id)
        assert rule.label == "New Rule"
        # check that the channel_id got added
        assert rule.data["actions"] == [
            {
                "channel": "#my-channel",
                "channel_id": "chan-id",
                "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                "tags": "",
                "workspace": self.integration.id,
            }
        ]
        assert rule.created_by_id == self.user.id

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
                "tags": "",
                "workspace": self.integration.id,
            }
        ]

    @responses.activate
    @patch.object(RedisRuleStatus, "set_value", return_value=None)
    @patch(
        "sentry.integrations.slack.utils.channel.get_channel_id_with_timeout",
        return_value=("#", "chan-id", False),
    )
    def test_task_new_alert_rule(self, mock_get_channel_id, mock_set_value):
        alert_rule_data = self.metric_alert_data()

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
        assert rule.created_by_id == self.user.id
        mock_set_value.assert_called_with("success", rule.id)
        mock_get_channel_id.assert_called_with(
            serialize_integration(self.integration), "my-channel", 180
        )

        trigger_action = AlertRuleTriggerAction.objects.get(integration_id=self.integration.id)
        assert trigger_action.target_identifier == "chan-id"

    @responses.activate
    @patch.object(RedisRuleStatus, "set_value", return_value=None)
    @patch(
        "sentry.integrations.slack.utils.channel.get_channel_id_with_timeout",
        return_value=("#", None, False),
    )
    def test_task_failed_id_lookup(self, mock_get_channel_id, mock_set_value):
        alert_rule_data = self.metric_alert_data()

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
            serialize_integration(self.integration), "my-channel", 180
        )

    @responses.activate
    @patch.object(RedisRuleStatus, "set_value", return_value=None)
    @patch(
        "sentry.integrations.slack.utils.channel.get_channel_id_with_timeout",
        return_value=("#", None, True),
    )
    def test_task_timeout_id_lookup(self, mock_get_channel_id, mock_set_value):
        alert_rule_data = self.metric_alert_data()

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
            serialize_integration(self.integration), "my-channel", 180
        )

    @responses.activate
    @patch.object(RedisRuleStatus, "set_value", return_value=None)
    @patch(
        "sentry.integrations.slack.utils.channel.get_channel_id_with_timeout",
        return_value=("#", "chan-id", False),
    )
    def test_task_existing_metric_alert(self, mock_get_channel_id, mock_set_value):
        alert_rule_data = self.metric_alert_data()
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
            serialize_integration(self.integration), "my-channel", 180
        )

        trigger_action = AlertRuleTriggerAction.objects.get(integration_id=self.integration.id)
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
                    "integration_id": self.integration.id,
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
                    "integration_id": self.integration.id,
                    "payload": {"key": ["val"]},
                    "log_error_message": "my_message",
                    "log_params": {"log_key": "log_value"},
                }
            )
        data = parse_qs(responses.calls[0].request.body)
        assert data == {"key": ["val"]}
