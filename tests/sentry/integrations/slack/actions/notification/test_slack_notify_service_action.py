from unittest.mock import MagicMock, patch

import orjson
from slack_sdk.errors import SlackApiError
from slack_sdk.web import SlackResponse

from sentry.integrations.slack import SlackNotifyServiceAction
from sentry.integrations.types import EventLifecycleOutcome
from sentry.notifications.models.notificationmessage import NotificationMessage
from sentry.notifications.types import NotificationActionContext, NotificationOrigin
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.silo.base import SiloMode
from sentry.testutils.asserts import assert_failure_metric
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.helpers.notifications import create_action_context_for_workflow
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.rules import RuleFuture


class TestInit(RuleTestCase):
    rule_cls = SlackNotifyServiceAction

    def setUp(self) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            self.organization = self.create_organization(owner=self.user)
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
        self.event = self.store_event(
            data={
                "message": "Hello world",
                "level": "warning",
                "platform": "python",
                "culprit": "foo.bar",
            },
            project_id=self.project.id,
        )
        assert self.event.group is not None

        self.action = self.create_action()
        self.workflow = self.create_workflow(organization=self.organization)
        self.action_context = create_action_context_for_workflow(
            self.workflow, self.action, self.project
        )
        self.legacy_action_context = NotificationActionContext(
            origin=NotificationOrigin(
                label="Test Alert",
                environment_id=None,
                workflow_id=None,
                legacy_rule_id=self.action.id,
            ),
            action_id=self.action.id,
            project=self.project,
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.slack.sdk_client.SlackSdkClient.chat_postMessage")
    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    def test_after_noa(
        self, mock_api_call: MagicMock, mock_post: MagicMock, mock_record: MagicMock
    ) -> None:
        mock_api_call.return_value = {
            "body": orjson.dumps({"ok": True}).decode(),
            "headers": {},
            "status": 200,
        }

        rule_cls_instance = self.get_rule(data=self.action_data)

        results = list(rule_cls_instance.after(event=self.event))
        assert len(results) == 1

        results[0].callback(
            self.event,
            futures=[RuleFuture(context=self.legacy_action_context, kwargs={})],
        )
        blocks = mock_post.call_args.kwargs["blocks"]
        blocks = orjson.loads(blocks)

        assert (
            blocks[0]["text"]["text"]
            == f":large_yellow_circle: <http://testserver/organizations/{self.organization.slug}/issues/{self.event.group.id}/?referrer=slack|*Hello world*>"
        )

        assert NotificationMessage.objects.all().count() == 1

        assert len(mock_record.mock_calls) == 4
        thread_ts_start, thread_ts_success, send_notification_start, send_notification_success = (
            mock_record.mock_calls
        )
        assert thread_ts_start.args[0] == EventLifecycleOutcome.STARTED
        assert thread_ts_success.args[0] == EventLifecycleOutcome.SUCCESS
        assert send_notification_start.args[0] == EventLifecycleOutcome.STARTED
        assert send_notification_success.args[0] == EventLifecycleOutcome.SUCCESS

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.slack.sdk_client.SlackSdkClient.chat_postMessage")
    def test_after_noa_slo_halt(self, mock_post: MagicMock, mock_record: MagicMock) -> None:
        mock_post.side_effect = SlackApiError(
            message="account_inactive",
            response=SlackResponse(
                client=None,
                http_verb="POST",
                api_url="https://slack.com/api/chat.postMessage",
                req_args={},
                data={"ok": False, "error": "account_inactive"},
                headers={},
                status_code=200,
            ),
        )

        rule_cls_instance = self.get_rule(data=self.action_data)

        results = list(rule_cls_instance.after(event=self.event))
        assert len(results) == 1

        results[0].callback(
            self.event,
            futures=[RuleFuture(context=self.legacy_action_context, kwargs={})],
        )
        blocks = mock_post.call_args.kwargs["blocks"]
        blocks = orjson.loads(blocks)

        assert (
            blocks[0]["text"]["text"]
            == f":large_yellow_circle: <http://testserver/organizations/{self.organization.slug}/issues/{self.event.group.id}/?referrer=slack|*Hello world*>"
        )

        assert (
            NotificationMessage.objects.all().count() == 1
        )  # we save the notification message for the error

        assert len(mock_record.mock_calls) == 4
        thread_ts_start, thread_ts_success, send_notification_start, send_notification_success = (
            mock_record.mock_calls
        )
        assert thread_ts_start.args[0] == EventLifecycleOutcome.STARTED
        assert thread_ts_success.args[0] == EventLifecycleOutcome.SUCCESS
        assert send_notification_start.args[0] == EventLifecycleOutcome.STARTED
        assert send_notification_success.args[0] == EventLifecycleOutcome.HALTED

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.slack.sdk_client.SlackSdkClient.chat_postMessage")
    def test_after_noa_error(
        self,
        mock_post: MagicMock,
        mock_record: MagicMock,
    ) -> None:
        mock_post.side_effect = SlackApiError(
            message="asdf",
            response=SlackResponse(
                client=None,
                http_verb="POST",
                api_url="https://slack.com/api/chat.postMessage",
                req_args={},
                data={"ok": False, "error": "asdf"},
                headers={},
                status_code=400,
            ),
        )
        # tests error flow because we're actually trying to POST
        rule_cls_instance = self.get_rule(data=self.action_data)

        results = list(rule_cls_instance.after(event=self.event))
        assert len(results) == 1

        results[0].callback(
            self.event,
            futures=[RuleFuture(context=self.legacy_action_context, kwargs={})],
        )

        assert NotificationMessage.objects.all().count() == 1

        assert len(mock_record.mock_calls) == 4
        thread_ts_start, thread_ts_failure, send_notification_start, send_notification_failure = (
            mock_record.mock_calls
        )
        assert thread_ts_start.args[0] == EventLifecycleOutcome.STARTED
        assert thread_ts_failure.args[0] == EventLifecycleOutcome.SUCCESS
        assert send_notification_start.args[0] == EventLifecycleOutcome.STARTED
        assert send_notification_failure.args[0] == EventLifecycleOutcome.FAILURE
        assert_failure_metric(mock_record, IntegrationError())

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.slack.sdk_client.SlackSdkClient.chat_postMessage")
    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    def test_after_noa_test_action(
        self, mock_api_call: MagicMock, mock_post: MagicMock, mock_record: MagicMock
    ) -> None:
        mock_api_call.return_value = {
            "body": orjson.dumps({"ok": True}).decode(),
            "headers": {},
            "status": 200,
        }

        rule_cls_instance = self.get_rule(data=self.action_data)

        results = list(rule_cls_instance.after(event=self.event))
        assert len(results) == 1

        results[0].callback(
            self.event,
            futures=[
                RuleFuture(
                    context=NotificationActionContext(
                        origin=NotificationOrigin(
                            label="Test Alert",
                            environment_id=None,
                            workflow_id=None,
                            legacy_rule_id=-1,
                        ),
                        action_id=-1,
                        project=self.project,
                    ),
                    kwargs={},
                )
            ],
        )
        blocks = mock_post.call_args.kwargs["blocks"]
        blocks = orjson.loads(blocks)

        assert (
            blocks[0]["text"]["text"]
            == f":large_yellow_circle: <http://testserver/organizations/{self.organization.slug}/issues/{self.event.group.id}/?referrer=slack|*Hello world*>"
        )

        # Test action should not create a notification message
        assert NotificationMessage.objects.all().count() == 0

        assert len(mock_record.mock_calls) == 2
        thread_ts_start, thread_ts_success = mock_record.mock_calls

        assert thread_ts_start.args[0] == EventLifecycleOutcome.STARTED
        assert thread_ts_success.args[0] == EventLifecycleOutcome.SUCCESS

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.slack.sdk_client.SlackSdkClient.chat_postMessage")
    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    def test_after_noa_new_ui(
        self, mock_api_call: MagicMock, mock_post: MagicMock, mock_record: MagicMock
    ) -> None:
        mock_api_call.return_value = {
            "body": orjson.dumps({"ok": True}).decode(),
            "headers": {},
            "status": 200,
        }

        context = self.action_context

        rule_cls_instance = self.get_rule(
            data=self.action_data,
            context=context,
        )

        results = list(rule_cls_instance.after(event=self.event))
        assert len(results) == 1

        results[0].callback(
            self.event,
            futures=[RuleFuture(context=context, kwargs={})],
        )
        blocks = mock_post.call_args.kwargs["blocks"]
        blocks = orjson.loads(blocks)

        assert (
            blocks[0]["text"]["text"]
            == f":large_yellow_circle: <http://testserver/organizations/{self.organization.slug}/issues/{self.event.group.id}/?referrer=slack&workflow_id={self.workflow.id}&alert_type=issue|*Hello world*>"
        )

        assert NotificationMessage.objects.all().count() == 1

        assert len(mock_record.mock_calls) == 4
        thread_ts_start, thread_ts_success, send_notification_start, send_notification_success = (
            mock_record.mock_calls
        )
        assert thread_ts_start.args[0] == EventLifecycleOutcome.STARTED
        assert thread_ts_success.args[0] == EventLifecycleOutcome.SUCCESS
        assert send_notification_start.args[0] == EventLifecycleOutcome.STARTED
        assert send_notification_success.args[0] == EventLifecycleOutcome.SUCCESS

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.slack.sdk_client.SlackSdkClient.chat_postMessage")
    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    def test_after_with_threads_noa(
        self, mock_api_call: MagicMock, mock_post: MagicMock, mock_record: MagicMock
    ) -> None:
        mock_api_call.return_value = {
            "body": orjson.dumps({"ok": True}).decode(),
            "headers": {},
            "status": 200,
        }

        context = self.action_context
        rule_cls_instance = self.get_rule(data=self.action_data, context=context)

        results = list(rule_cls_instance.after(event=self.event))
        assert len(results) == 1

        results[0].callback(
            self.event,
            futures=[RuleFuture(context=context, kwargs={})],
        )
        blocks = mock_post.call_args.kwargs["blocks"]
        blocks = orjson.loads(blocks)

        assert (
            blocks[0]["text"]["text"]
            == f":large_yellow_circle: <http://testserver/organizations/{self.organization.slug}/issues/{self.event.group.id}/?referrer=slack&workflow_id={self.workflow.id}&alert_type=issue|*Hello world*>"
        )

        assert NotificationMessage.objects.all().count() == 1

        assert len(mock_record.mock_calls) == 4
        thread_ts_start, thread_ts_success, send_notification_start, send_notification_success = (
            mock_record.mock_calls
        )
        assert thread_ts_start.args[0] == EventLifecycleOutcome.STARTED
        assert thread_ts_success.args[0] == EventLifecycleOutcome.SUCCESS
        assert send_notification_start.args[0] == EventLifecycleOutcome.STARTED
        assert send_notification_success.args[0] == EventLifecycleOutcome.SUCCESS

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @patch("sentry.integrations.slack.sdk_client.SlackSdkClient.chat_postMessage")
    @patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    def test_after_reply_in_thread_noa(
        self, mock_api_call: MagicMock, mock_post: MagicMock, mock_record: MagicMock
    ) -> None:
        mock_api_call.return_value = {
            "body": orjson.dumps({"ok": True}).decode(),
            "headers": {},
            "status": 200,
        }

        with assume_test_silo_mode(SiloMode.CELL):
            msg = NotificationMessage.objects.create(
                action_id=self.action.id,
                group_id=self.event.group.id,
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

        context = self.action_context
        rule_cls_instance = self.get_rule(data=self.action_data, context=context)

        results = list(rule_cls_instance.after(event=event))
        assert len(results) == 1

        results[0].callback(
            self.event,
            futures=[RuleFuture(context=context, kwargs={})],
        )
        blocks = mock_post.call_args.kwargs["blocks"]
        blocks = orjson.loads(blocks)

        assert (
            blocks[0]["text"]["text"]
            == f":large_yellow_circle: <http://testserver/organizations/{self.organization.slug}/issues/{self.event.group.id}/?referrer=slack&workflow_id={self.workflow.id}&alert_type=issue|*Hello world*>"
        )

        assert NotificationMessage.objects.all().count() == 2
        assert (
            NotificationMessage.objects.filter(parent_notification_message_id=msg.id).count() == 1
        )

        assert len(mock_record.mock_calls) == 4
        thread_ts_start, thread_ts_success, send_notification_start, send_notification_success = (
            mock_record.mock_calls
        )
        assert thread_ts_start.args[0] == EventLifecycleOutcome.STARTED
        assert thread_ts_success.args[0] == EventLifecycleOutcome.SUCCESS
        assert send_notification_start.args[0] == EventLifecycleOutcome.STARTED
        assert send_notification_success.args[0] == EventLifecycleOutcome.SUCCESS
