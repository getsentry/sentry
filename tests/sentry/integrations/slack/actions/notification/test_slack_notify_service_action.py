from unittest.mock import patch
from urllib.parse import parse_qs
from uuid import uuid4

import orjson
import responses

from sentry.integrations.slack import SlackNotifyServiceAction
from sentry.integrations.slack.sdk_client import SLACK_DATADOG_METRIC
from sentry.models.notificationmessage import NotificationMessage
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.silo.base import SiloMode
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.rules import RuleFuture


class TestInit(RuleTestCase):
    rule_cls = SlackNotifyServiceAction

    def setUp(self) -> None:
        with assume_test_silo_mode(SiloMode.REGION):
            self.organization = self.create_organization(id=1, owner=self.user)
            self.project = self.create_project(organization=self.organization)

        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = self.create_integration(
                organization=self.organization,
                name="slack",
                provider="slack",
                external_id="slack:1",
                metadata={"access_token": "xoxb-access-token"},
            )
        self.uuid = "5bac5dcc-e201-4cb2-8da2-bac39788a13d"
        self.action_data = {
            "workspace": str(self.integration.id),
            "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
            "channel_id": "C0123456789",
            "tags": "",
            "channel": "test-notifications",
            "uuid": self.uuid,
        }
        self.rule = self.create_project_rule(project=self.project, action_match=[self.action_data])
        self.notification_uuid = str(uuid4())
        self.event = self.store_event(
            data={
                "message": "Hello world",
                "level": "warning",
                "platform": "python",
                "culprit": "foo.bar",
            },
            project_id=self.project.id,
        )
        self.rule_fire_history = RuleFireHistory.objects.create(
            project=self.project,
            rule=self.rule,
            group=self.event.group,
            event_id=self.event.event_id,
            notification_uuid=self.notification_uuid,
        )

    def test_when_rule_fire_history_is_passed_in(self) -> None:
        instance = SlackNotifyServiceAction(
            self.project, data={}, rule=self.rule, rule_fire_history=self.rule_fire_history
        )
        assert instance.rule_fire_history is not None

    def test_when_rule_fire_history_is_not_passed_in(self) -> None:
        instance = SlackNotifyServiceAction(self.project, data={}, rule=self.rule)
        assert instance.rule_fire_history is None

    def test_when_rule_fire_history_is_none(self) -> None:
        instance = SlackNotifyServiceAction(
            self.project, data={}, rule=self.rule, rule_fire_history=None
        )
        assert instance.rule_fire_history is None

    @responses.activate
    def test_after(self):
        rule = self.get_rule(data=self.action_data)
        results = list(rule.after(event=self.event))
        assert len(results) == 1

        responses.add(
            responses.POST,
            url="https://slack.com/api/chat.postMessage",
            json={},
            status=200,
        )

        results[0].callback(self.event, futures=[])
        data = parse_qs(responses.calls[0].request.body)
        blocks = orjson.loads(data["blocks"][0])

        assert (
            blocks[0]["text"]["text"]
            == f":large_yellow_circle: <http://testserver/organizations/{self.organization.slug}/issues/{self.event.group.id}/?referrer=slack|*Hello world*>"
        )

        assert NotificationMessage.objects.all().count() == 0

    @override_options({"slack.sdk-web-client": [1]})
    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    @patch("sentry.integrations.slack.sdk_client.metrics")
    def test_after_using_sdk(self, mock_metrics, mock_api_call):
        mock_api_call.return_value = {
            "body": orjson.dumps({"ok": True}).decode(),
            "headers": {},
            "status": 200,
        }

        rule = self.get_rule(data=self.action_data)
        results = list(rule.after(event=self.event))
        assert len(results) == 1

        results[0].callback(self.event, futures=[])

        mock_metrics.incr.assert_called_with(
            SLACK_DATADOG_METRIC, sample_rate=1.0, tags={"ok": True, "status": 200}
        )

        assert NotificationMessage.objects.all().count() == 0

    @override_options({"slack.sdk-web-client": [1]})
    @patch("sentry.integrations.slack.sdk_client.metrics")
    def test_after_using_sdk_error(self, mock_metrics):
        # tests error flow because we're actually trying to POST

        rule = self.get_rule(data=self.action_data)
        results = list(rule.after(event=self.event))
        assert len(results) == 1

        results[0].callback(self.event, futures=[])

        mock_metrics.incr.assert_called_with(
            SLACK_DATADOG_METRIC, sample_rate=1.0, tags={"ok": False, "status": 200}
        )

        assert NotificationMessage.objects.all().count() == 0

    @with_feature("organizations:slack-thread-issue-alert")
    @responses.activate
    def test_after_with_threads(self):
        rule = self.get_rule(data=self.action_data, rule_fire_history=self.rule_fire_history)
        results = list(rule.after(event=self.event))
        assert len(results) == 1

        responses.add(
            responses.POST,
            url="https://slack.com/api/chat.postMessage",
            json={},
            status=200,
        )

        results[0].callback(self.event, futures=[RuleFuture(rule=self.rule, kwargs={})])
        data = parse_qs(responses.calls[0].request.body)
        blocks = orjson.loads(data["blocks"][0])

        assert (
            blocks[0]["text"]["text"]
            == f":large_yellow_circle: <http://testserver/organizations/{self.organization.slug}/issues/{self.event.group.id}/?referrer=slack&alert_rule_id={self.rule.id}&alert_type=issue|*Hello world*>"
        )

        assert NotificationMessage.objects.all().count() == 1

    @with_feature("organizations:slack-thread-issue-alert")
    @responses.activate
    def test_after_reply_in_thread(self):
        with assume_test_silo_mode(SiloMode.REGION):
            msg = NotificationMessage.objects.create(
                rule_fire_history_id=self.rule_fire_history.id,
                rule_action_uuid=self.uuid,
            )

        event = self.store_event(
            data={
                "message": "Hello world",
                "level": "warning",
                "platform": "python",
                "culprit": "foo.bar",
            },
            project_id=self.project.id,
        )
        rule_fire_history = RuleFireHistory.objects.create(
            project=self.project,
            rule=self.rule,
            group=self.event.group,
            event_id=event.event_id,
            notification_uuid=self.notification_uuid,
        )

        rule = self.get_rule(data=self.action_data, rule_fire_history=rule_fire_history)
        results = list(rule.after(event=event))
        assert len(results) == 1

        responses.add(
            responses.POST,
            url="https://slack.com/api/chat.postMessage",
            json={},
            status=200,
        )

        results[0].callback(self.event, futures=[RuleFuture(rule=self.rule, kwargs={})])
        data = parse_qs(responses.calls[0].request.body)
        blocks = orjson.loads(data["blocks"][0])

        assert (
            blocks[0]["text"]["text"]
            == f":large_yellow_circle: <http://testserver/organizations/{self.organization.slug}/issues/{self.event.group.id}/?referrer=slack&alert_rule_id={self.rule.id}&alert_type=issue|*Hello world*>"
        )

        assert NotificationMessage.objects.all().count() == 2
        assert (
            NotificationMessage.objects.filter(parent_notification_message_id=msg.id).count() == 1
        )

    @override_options({"slack.sdk-web-client": [1]})
    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    @patch("sentry.integrations.slack.sdk_client.metrics")
    def test_send_confirmation_using_sdk(self, mock_metrics, mock_api_call):
        mock_api_call.return_value = {
            "body": orjson.dumps({"ok": True}).decode(),
            "headers": {},
            "status": 200,
        }
        rule = self.get_rule(data=self.action_data)
        rule.send_confirmation_notification(self.rule, new=False)

        mock_metrics.incr.assert_called_with(
            SLACK_DATADOG_METRIC, sample_rate=1.0, tags={"ok": True, "status": 200}
        )

    @override_options({"slack.sdk-web-client": [1]})
    @patch("sentry.integrations.slack.sdk_client.metrics")
    def test_send_confirmation_using_sdk_error(self, mock_metrics):
        # tests error flow because we're actually trying to POST

        rule = self.get_rule(data=self.action_data)
        rule.send_confirmation_notification(self.rule, new=False)

        mock_metrics.incr.assert_called_with(
            SLACK_DATADOG_METRIC, sample_rate=1.0, tags={"ok": False, "status": 200}
        )
