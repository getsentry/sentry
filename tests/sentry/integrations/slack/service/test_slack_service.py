from datetime import datetime
from unittest import mock
from uuid import uuid4

import orjson
import pytest
import responses
from slack_sdk.errors import SlackApiError

from sentry.integrations.repository.issue_alert import IssueAlertNotificationMessage
from sentry.integrations.slack.client import SlackClient
from sentry.integrations.slack.sdk_client import SlackSdkClient
from sentry.integrations.slack.service import RuleDataError, SlackService
from sentry.models.activity import Activity
from sentry.models.notificationmessage import NotificationMessage
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.activity import ActivityType


class TestGetNotificationMessageToSend(TestCase):
    def setUp(self) -> None:
        self.service = SlackService.default()

    def test_ignores_unsupported_activity(self) -> None:
        activity = Activity.objects.create(
            group=self.group,
            project=self.project,
            type=ActivityType.FIRST_SEEN.value,
            user_id=self.user.id,
            data={},
        )
        result = self.service._get_notification_message_to_send(activity=activity)
        assert result is None

    def test_simple(self) -> None:
        activity = Activity.objects.create(
            group=self.group,
            project=self.project,
            type=ActivityType.SET_IGNORED.value,
            user_id=self.user.id,
            data={"ignoreUntilEscalating": True},
        )
        result = self.service._get_notification_message_to_send(activity=activity)
        assert result == "admin@localhost archived BAR-1"


@mock.patch("sentry.integrations.slack.service")
class TestNotifyAllThreadsForActivity(TestCase):
    def setUp(self) -> None:
        self.service = SlackService.default()
        self.activity = Activity.objects.create(
            group=self.group,
            project=self.project,
            type=ActivityType.SET_IGNORED.value,
            user_id=self.user.id,
            data={"ignoreUntilEscalating": True},
        )

        self.rule_action_uuid = str(uuid4())
        self.notify_issue_owners_action = [
            {
                "targetType": "IssueOwners",
                "fallthroughType": "ActiveMembers",
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetIdentifier": "",
                "uuid": self.rule_action_uuid,
            }
        ]
        self.rule = self.create_project_rule(
            project=self.project, action_match=self.notify_issue_owners_action
        )
        self.rule_fire_history = RuleFireHistory.objects.create(
            project=self.project,
            rule=self.rule,
            group=self.group,
            event_id=456,
            notification_uuid=str(uuid4()),
        )
        self.parent_notification = NotificationMessage.objects.create(
            rule_fire_history_id=self.rule_fire_history.id,
            rule_action_uuid=self.rule_action_uuid,
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = self.create_integration(
                organization=self.organization,
                name="slack",
                provider="slack",
                external_id="slack:1",
                metadata={"access_token": "xoxb-access-token"},
            )

    def test_none_group(self, mock_logger):
        self.activity.update(group=None)
        self.service.notify_all_threads_for_activity(activity=self.activity)
        assert mock_logger.info.called_with("no group associated on the activity, nothing to do")

    def test_none_user_id(self, mock_logger):
        self.activity.update(user_id=None)
        self.service.notify_all_threads_for_activity(activity=self.activity)
        assert mock_logger.info.called_with("no user associated on the activity, nothing to do")

    def test_disabled_option(self, mock_logger):
        OrganizationOption.objects.set_value(
            self.organization, "sentry:issue_alerts_thread_flag", False
        )
        self.service.notify_all_threads_for_activity(activity=self.activity)
        assert mock_logger.info.called_with("feature is turned off for this organization")

    def test_no_message_to_send(self, mock_logger):
        # unsupported activity
        self.activity.update(type=ActivityType.FIRST_SEEN.value)
        self.service.notify_all_threads_for_activity(activity=self.activity)
        assert mock_logger.info.called_with("notification to send is invalid")

    def test_no_integration(self, mock_logger):
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.delete()
        self.service.notify_all_threads_for_activity(activity=self.activity)
        assert mock_logger.info.called_with("no integration found for activity")

    @mock.patch("sentry.integrations.slack.service.SlackService._handle_parent_notification")
    def test_no_parent_notification(self, mock_handle, mock_logger):
        self.parent_notification.delete()
        self.service.notify_all_threads_for_activity(activity=self.activity)
        assert not mock_handle.called

    @mock.patch("sentry.integrations.slack.service.SlackService._handle_parent_notification")
    def test_calls_handle_parent_notification(self, mock_handle, mock_logger):
        parent_notification = IssueAlertNotificationMessage.from_model(
            instance=self.parent_notification
        )
        self.service.notify_all_threads_for_activity(activity=self.activity)

        mock_handle.assert_called()
        assert mock_handle.call_args.kwargs["parent_notification"] == parent_notification

        # check client type
        assert isinstance(mock_handle.call_args.kwargs["client"], SlackClient)

    @mock.patch("sentry.integrations.slack.service.SlackService._handle_parent_notification")
    @with_feature("organizations:slack-sdk-activity-threads")
    def test_calls_handle_parent_notification_sdk_client(self, mock_handle, mock_logger):
        parent_notification = IssueAlertNotificationMessage.from_model(
            instance=self.parent_notification
        )
        self.service.notify_all_threads_for_activity(activity=self.activity)

        mock_handle.assert_called()
        assert mock_handle.call_args.kwargs["parent_notification"] == parent_notification

        # check client type
        assert isinstance(mock_handle.call_args.kwargs["client"], SlackSdkClient)


class TestHandleParentNotification(TestCase):
    def setUp(self) -> None:
        """
        Setup default and reusable testing data or objects
        """
        self.service = SlackService.default()

        self.rule_action_uuid = str(uuid4())
        self.notify_issue_owners_action = [
            {
                "targetType": "IssueOwners",
                "fallthroughType": "ActiveMembers",
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetIdentifier": "",
                "uuid": self.rule_action_uuid,
            }
        ]
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = self.create_integration(
                organization=self.organization,
                name="slack",
                provider="slack",
                external_id="slack:1",
                metadata={"access_token": "xoxb-access-token"},
            )
        self.slack_action = {
            "workspace": str(self.integration.id),
            "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
            "channel_id": "C0123456789",
            "tags": "",
            "channel": "test-notifications",
            "uuid": self.rule_action_uuid,
        }
        self.rule = self.create_project_rule(
            project=self.project, action_match=self.notify_issue_owners_action
        )
        self.rule_fire_history = RuleFireHistory.objects.create(
            project=self.project,
            rule=self.rule,
            group=self.group,
            event_id=456,
            notification_uuid=str(uuid4()),
        )

        self.slack_rule = self.create_project_rule(
            project=self.project, action_match=[self.slack_action]
        )
        self.slack_rule_fire_history = RuleFireHistory.objects.create(
            project=self.project,
            rule=self.slack_rule,
            group=self.group,
            event_id=543,
            notification_uuid=str(uuid4()),
        )
        self.parent_notification = IssueAlertNotificationMessage(
            id=123,
            date_added=datetime.now(),
            message_identifier="1a2s3d",
            rule_action_uuid=self.rule_action_uuid,
            rule_fire_history=self.slack_rule_fire_history,
        )

    @responses.activate
    def test_handles_parent_notification(
        self,
    ) -> None:
        responses.add(
            responses.POST,
            url="https://slack.com/api/chat.postMessage",
            json={"ok": True},
            status=200,
        )
        self.service._handle_parent_notification(
            parent_notification=self.parent_notification,
            notification_to_send="",
            client=SlackClient(integration_id=self.integration.id),
        )

    @responses.activate
    def test_handles_parent_notification_slack_error(
        self,
    ) -> None:
        responses.add(
            responses.POST,
            url="https://slack.com/api/chat.postMessage",
            json={},
            status=500,
        )
        with pytest.raises(Exception):
            self.service._handle_parent_notification(
                parent_notification=self.parent_notification,
                notification_to_send="",
                client=SlackClient(integration_id=self.integration.id),
            )

    @mock.patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    def test_handles_parent_notification_sdk(self, mock_api_call):
        mock_api_call.return_value = {
            "body": orjson.dumps({"ok": True}).decode(),
            "headers": {},
            "status": 200,
        }
        self.service._handle_parent_notification(
            parent_notification=self.parent_notification,
            notification_to_send="hello",
            client=SlackSdkClient(integration_id=self.integration.id),
        )

    def test_handles_parent_notification_sdk_error(
        self,
    ) -> None:
        with pytest.raises(SlackApiError):
            self.service._handle_parent_notification(
                parent_notification=self.parent_notification,
                notification_to_send="hello",
                client=SlackSdkClient(integration_id=self.integration.id),
            )

    def test_raises_exception_when_parent_notification_does_not_have_rule_fire_history_data(
        self,
    ) -> None:
        """
        Purposefully create a domain object that does not have rule_fire_history
        """
        parent_notification = IssueAlertNotificationMessage(
            id=123,
            date_added=datetime.now(),
            message_identifier="1a2s3d",
            rule_action_uuid=str(uuid4()),
        )
        with pytest.raises(RuleDataError) as err:
            self.service._handle_parent_notification(
                parent_notification=parent_notification,
                notification_to_send="",
                client=mock.MagicMock(),
            )
            assert (
                err.value
                == f"parent notification {parent_notification.id} does not have a rule_fire_history"
            )

    def test_raises_exception_when_parent_notification_does_not_have_rule_action_uuid(self) -> None:
        """
        Purposefully create a domain object that does not have the rule_action_uuid
        """
        parent_notification = IssueAlertNotificationMessage(
            id=123,
            date_added=datetime.now(),
            message_identifier="1a2s3d",
            rule_fire_history=self.rule_fire_history,
        )
        with pytest.raises(RuleDataError) as err:
            self.service._handle_parent_notification(
                parent_notification=parent_notification,
                notification_to_send="",
                client=mock.MagicMock(),
            )
            assert (
                err.value
                == f"parent notification {parent_notification.id} does not have a rule_action_uuid"
            )

    def test_raises_exception_when_rule_action_does_not_exist(self) -> None:
        """
        Purposefully create a mismatch between the rule action uuid so that it does not exist
        """
        notify_issue_owners_action = [
            {
                "targetType": "IssueOwners",
                "fallthroughType": "ActiveMembers",
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetIdentifier": "",
                "uuid": (uuid4()),
            }
        ]
        rule = self.create_project_rule(
            project=self.project, action_match=notify_issue_owners_action
        )
        rule_fire_history = RuleFireHistory.objects.create(
            project=self.project,
            rule=rule,
            group=self.group,
            event_id=456,
            notification_uuid=str(uuid4()),
        )
        parent_notification_message = NotificationMessage.objects.create(
            rule_fire_history=rule_fire_history,
            rule_action_uuid=str(uuid4()),
            message_identifier="123abc",
        )
        parent_notification = IssueAlertNotificationMessage.from_model(parent_notification_message)
        with pytest.raises(RuleDataError) as err:
            self.service._handle_parent_notification(
                parent_notification=parent_notification,
                notification_to_send="",
                client=mock.MagicMock(),
            )
            assert (
                err.value
                == f"failed to find rule action {parent_notification.rule_action_uuid} for rule {rule.id}"
            )

    def test_raises_exception_when_rule_action_does_not_have_channel_id(self) -> None:
        parent_notification_message = NotificationMessage.objects.create(
            rule_fire_history=self.rule_fire_history,
            rule_action_uuid=self.rule_action_uuid,
            message_identifier="123abc",
        )
        parent_notification = IssueAlertNotificationMessage.from_model(parent_notification_message)
        with pytest.raises(RuleDataError) as err:
            self.service._handle_parent_notification(
                parent_notification=parent_notification,
                notification_to_send="",
                client=mock.MagicMock(),
            )
            assert (
                err.value
                == f"failed to get channel_id for rule {self.rule.id} and rule action {parent_notification.rule_action_uuid}"
            )
