from datetime import datetime, timedelta
from unittest import mock
from uuid import uuid4

import orjson
import pytest
from django.utils import timezone
from slack_sdk.errors import SlackApiError

from sentry.integrations.repository.issue_alert import IssueAlertNotificationMessage
from sentry.integrations.slack.sdk_client import SlackSdkClient
from sentry.integrations.slack.service import RuleDataError, SlackService
from sentry.integrations.types import EventLifecycleOutcome
from sentry.issues.grouptype import UptimeDomainCheckFailure
from sentry.models.activity import Activity
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.notifications.models.notificationmessage import NotificationMessage
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.datetime import freeze_time
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


@freeze_time("2025-01-01 00:00:00")
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
            project=self.project, action_data=self.notify_issue_owners_action
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

    def test_none_group(self):
        self.activity.update(group=None)

        with mock.patch.object(self.service, "_logger") as mock_logger:
            self.service.notify_all_threads_for_activity(activity=self.activity)
            mock_logger.info.assert_called_with(
                "no group associated on the activity, nothing to do",
                extra={
                    "activity_id": self.activity.id,
                    "project_id": self.activity.project.id,
                },
            )

    def test_none_user_id(self):
        self.activity.update(user_id=None)

        with mock.patch.object(self.service, "_logger") as mock_logger:
            self.service.notify_all_threads_for_activity(activity=self.activity)
            mock_logger.info.assert_called_with(
                "machine/system updates are ignored at this time, nothing to do",
                extra={
                    "activity_id": self.activity.id,
                    "project_id": self.activity.project.id,
                    "group_id": self.activity.group.id,
                    "organization_id": self.organization.id,
                },
            )

    def test_disabled_option(self):
        OrganizationOption.objects.set_value(
            self.organization, "sentry:issue_alerts_thread_flag", False
        )

        with mock.patch.object(self.service, "_logger") as mock_logger:
            self.service.notify_all_threads_for_activity(activity=self.activity)
            mock_logger.info.assert_called_with(
                "feature is turned off for this organization",
                extra={
                    "activity_id": self.activity.id,
                    "project_id": self.activity.project.id,
                    "group_id": self.activity.group.id,
                    "organization_id": self.organization.id,
                },
            )

    def test_no_message_to_send(self):
        # unsupported activity
        self.activity.update(type=ActivityType.FIRST_SEEN.value)

        with mock.patch.object(self.service, "_logger") as mock_logger:
            self.service.notify_all_threads_for_activity(activity=self.activity)
            mock_logger.info.assert_called_with(
                "notification to send is invalid",
                extra={
                    "activity_id": self.activity.id,
                    "project_id": self.activity.project.id,
                    "group_id": self.activity.group.id,
                    "organization_id": self.organization.id,
                },
            )

    def test_no_integration(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.delete()

        with mock.patch.object(self.service, "_logger") as mock_logger:
            self.service.notify_all_threads_for_activity(activity=self.activity)
            mock_logger.info.assert_called_with(
                "no integration found for activity",
                extra={
                    "activity_id": self.activity.id,
                    "project_id": self.activity.project.id,
                    "group_id": self.activity.group.id,
                    "organization_id": self.organization.id,
                },
            )

    @mock.patch("sentry.integrations.slack.service.SlackService._handle_parent_notification")
    def test_no_parent_notification(self, mock_handle):
        self.parent_notification.delete()
        self.service.notify_all_threads_for_activity(activity=self.activity)
        assert not mock_handle.called

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @mock.patch("sentry.integrations.slack.service.SlackService._handle_parent_notification")
    def test_calls_handle_parent_notification(self, mock_handle, mock_record):
        parent_notification = IssueAlertNotificationMessage.from_model(
            instance=self.parent_notification
        )
        self.service.notify_all_threads_for_activity(activity=self.activity)

        mock_handle.assert_called()
        assert mock_handle.call_args.kwargs["parent_notification"] == parent_notification

        # check client type
        assert isinstance(mock_handle.call_args.kwargs["client"], SlackSdkClient)

        assert len(mock_record.mock_calls) == 4
        start_1, end_1, start_2, end_2 = mock_record.mock_calls
        assert start_1.args[0] == EventLifecycleOutcome.STARTED
        assert start_2.args[0] == EventLifecycleOutcome.STARTED
        assert end_1.args[0] == EventLifecycleOutcome.SUCCESS
        assert end_2.args[0] == EventLifecycleOutcome.SUCCESS

    @with_feature("organizations:slack-threads-refactor-uptime")
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @mock.patch("sentry.integrations.slack.service.SlackService._handle_parent_notification")
    def test_handle_parent_notification_with_open_period(self, mock_handle, mock_record) -> None:
        group = self.create_group(type=UptimeDomainCheckFailure.type_id)

        activity = Activity.objects.create(
            group=group,
            project=self.project,
            type=ActivityType.SET_IGNORED.value,
            user_id=self.user.id,
            data={"ignoreUntilEscalating": True},
        )

        rule_fire_history = RuleFireHistory.objects.create(
            project=self.project,
            rule=self.rule,
            group=group,
            event_id=456,
            notification_uuid=str(uuid4()),
        )

        # Create two parent notifications with different open periods
        NotificationMessage.objects.create(
            id=123,
            date_added=timezone.now(),
            message_identifier="1a2s3d",
            rule_action_uuid=self.rule_action_uuid,
            rule_fire_history=rule_fire_history,
            open_period_start=timezone.now() - timedelta(minutes=1),
        )

        parent_notification_2_message = NotificationMessage.objects.create(
            id=124,
            date_added=timezone.now(),
            message_identifier="1a2s3d",
            rule_action_uuid=self.rule_action_uuid,
            rule_fire_history=rule_fire_history,
            open_period_start=timezone.now(),
        )

        self.service.notify_all_threads_for_activity(activity=activity)

        # Verify only one notification was handled
        assert mock_handle.call_count == 1
        # Verify it was the newer notification
        mock_handle.assert_called_once()
        assert (
            mock_handle.call_args.kwargs["parent_notification"].id
            == parent_notification_2_message.id
        )

    @with_feature("organizations:slack-threads-refactor-uptime")
    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @mock.patch("sentry.integrations.slack.service.SlackService._handle_parent_notification")
    def test_handle_parent_notification_with_open_period_uptime_resolved(
        self, mock_handle, mock_record
    ) -> None:
        group = self.create_group(type=UptimeDomainCheckFailure.type_id)

        activity = Activity.objects.create(
            group=group,
            project=self.project,
            type=ActivityType.SET_RESOLVED.value,
            user_id=None,
            data={"ignoreUntilEscalating": True},
        )

        rule_fire_history = RuleFireHistory.objects.create(
            project=self.project,
            rule=self.rule,
            group=group,
            event_id=456,
            notification_uuid=str(uuid4()),
        )

        # Create two parent notifications with different open periods
        NotificationMessage.objects.create(
            id=123,
            date_added=timezone.now(),
            message_identifier="1a2s3d",
            rule_action_uuid=self.rule_action_uuid,
            rule_fire_history=rule_fire_history,
            open_period_start=timezone.now() - timedelta(minutes=1),
        )

        parent_notification_2_message = NotificationMessage.objects.create(
            id=124,
            date_added=timezone.now(),
            message_identifier="1a2s3d",
            rule_action_uuid=self.rule_action_uuid,
            rule_fire_history=rule_fire_history,
            open_period_start=timezone.now(),
        )

        self.service.notify_all_threads_for_activity(activity=activity)

        # Verify only one notification was handled
        assert mock_handle.call_count == 1
        # Verify it was the newer notification for resolved activities
        mock_handle.assert_called_once()
        assert (
            mock_handle.call_args.kwargs["parent_notification"].id
            == parent_notification_2_message.id
        )


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
            project=self.project, action_data=self.notify_issue_owners_action
        )
        self.rule_fire_history = RuleFireHistory.objects.create(
            project=self.project,
            rule=self.rule,
            group=self.group,
            event_id=456,
            notification_uuid=str(uuid4()),
        )

        self.slack_rule = self.create_project_rule(
            project=self.project, action_data=[self.slack_action]
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

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @mock.patch("slack_sdk.web.client.WebClient._perform_urllib_http_request")
    def test_handles_parent_notification(self, mock_api_call, mock_record):
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

    @mock.patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_handles_parent_notification_error(
        self,
        mock_record,
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
            project=self.project, action_data=notify_issue_owners_action
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
        with pytest.raises(RuleDataError) as excinfo:
            self.service._handle_parent_notification(
                parent_notification=parent_notification,
                notification_to_send="",
                client=mock.MagicMock(),
            )
        assert (
            str(excinfo.value)
            == f"failed to get channel_id for rule {self.rule.id} and rule action {parent_notification.rule_action_uuid}"
        )
