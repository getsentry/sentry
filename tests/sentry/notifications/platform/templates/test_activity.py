from unittest import mock
from urllib.parse import urlencode

from sentry.models.activity import Activity
from sentry.models.groupemailthread import GroupEmailThread
from sentry.notifications.models.notificationthread import NotificationThread
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.target import (
    GenericNotificationTarget,
    IntegrationNotificationTarget,
)
from sentry.notifications.platform.templates.activity.assigned import get_assigned_subject
from sentry.notifications.platform.templates.activity.base import (
    ACTIVITY_NOTIFICATION_REFERRER,
    ACTIVITY_TYPE_TO_SOURCE,
    EXAMPLE_ALERT_URL,
    EXAMPLE_ISSUE_URL,
    EXAMPLE_PROJECT_URL,
    EXAMPLE_USER_SETTINGS_URL,
    ActivityNotificationData,
    AssignedNotificationData,
    SetResolvedInReleaseNotificationData,
    build_activity_notification_data,
    build_footer,
    build_issue_link,
    build_subject_prefix,
    create_activity_notification_example,
    get_activity_email_threading_options,
    get_issue_description,
)
from sentry.notifications.platform.templates.activity.seer.base import (
    get_subject,
)
from sentry.notifications.platform.templates.activity.status_change.base import (
    get_status_change_subject,
)
from sentry.notifications.platform.types import (
    LinkTextBlock,
    NotificationProviderKey,
    NotificationSource,
    NotificationTargetResourceType,
    NotificationTextBlockType,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.types.activity import ActivityType
from sentry.utils.http import absolute_uri


class ActivityAlertBaseTest(TestCase):
    def setUp(self) -> None:
        self.target = GenericNotificationTarget(
            provider_key=NotificationProviderKey.EMAIL,
            resource_type=NotificationTargetResourceType.EMAIL,
            resource_id=str(self.user.id),
        )

    def test_all_seer_activity_types_mapped(self) -> None:
        seer_types = [
            ActivityType.SEER_RCA_STARTED,
            ActivityType.SEER_RCA_COMPLETED,
            ActivityType.SEER_SOLUTION_STARTED,
            ActivityType.SEER_SOLUTION_COMPLETED,
            ActivityType.SEER_CODING_STARTED,
            ActivityType.SEER_CODING_COMPLETED,
            ActivityType.SEER_PR_CREATED,
            ActivityType.SEER_PR_READY_FOR_REVIEW,
            ActivityType.SEER_ITERATION_STARTED,
            ActivityType.SEER_ITERATION_COMPLETED,
        ]
        for activity_type in seer_types:
            assert activity_type.value in ACTIVITY_TYPE_TO_SOURCE

    def test_all_resolved_activity_types_mapped(self) -> None:
        resolved_types = [
            ActivityType.SET_RESOLVED,
            ActivityType.SET_RESOLVED_IN_RELEASE,
            ActivityType.SET_RESOLVED_BY_AGE,
            ActivityType.SET_RESOLVED_IN_COMMIT,
        ]
        for activity_type in resolved_types:
            assert activity_type.value in ACTIVITY_TYPE_TO_SOURCE

    def test_build_footer(self) -> None:
        footer = build_footer(
            data=create_activity_notification_example(ActivityType.SEER_RCA_STARTED)
        )
        assert footer[0].type == NotificationTextBlockType.PLAIN_TEXT
        assert footer[0].text == "Project:"
        assert isinstance(footer[1], LinkTextBlock)
        assert footer[1].text == "javascript"
        assert footer[1].url == EXAMPLE_PROJECT_URL
        assert isinstance(footer[4], LinkTextBlock)
        assert footer[4].url == EXAMPLE_ALERT_URL
        assert isinstance(footer[6], LinkTextBlock)
        assert footer[6].text == "Manage Preferences"
        assert footer[6].url == EXAMPLE_USER_SETTINGS_URL

    def test_build_footer_no_alert(self) -> None:
        data = create_activity_notification_example(ActivityType.SEER_RCA_STARTED).copy(
            update={"alert_name": None, "alert_url": None}
        )
        footer = build_footer(data=data)
        assert not any(isinstance(b, LinkTextBlock) and b.url == EXAMPLE_ALERT_URL for b in footer)

    def test_build_issue_link(self) -> None:
        label = build_issue_link(issue_short_id="PROJ-1", issue_url=EXAMPLE_ISSUE_URL)
        assert label.type == NotificationTextBlockType.LINK
        assert label.text == "PROJ-1"

    def test_build_issue_link_no_short_id(self) -> None:
        label = build_issue_link(issue_short_id=None, issue_url=EXAMPLE_ISSUE_URL)
        assert label.text == "This issue"

    def test_get_issue_description(self) -> None:
        data = create_activity_notification_example(ActivityType.SEER_RCA_STARTED)
        sections = get_issue_description(data)
        assert len(sections) == 2
        blocks = sections[0].blocks
        assert blocks[0].type == NotificationTextBlockType.LINK
        assert any(
            b.type == NotificationTextBlockType.CODE and b.text == "/api/v1/users/list/"
            for b in blocks
        )
        assert (
            sections[1].blocks[0].text
            == "Cannot read properties of null (reading 'example_property')"
        )

    def test_get_issue_description_no_culprit(self) -> None:
        data = create_activity_notification_example(ActivityType.SEER_RCA_STARTED).copy(
            update={"issue_culprit": None}
        )
        sections = get_issue_description(data)
        blocks = sections[0].blocks
        assert not any(b.type == NotificationTextBlockType.CODE for b in blocks)

    def test_build_activity_notification_data(self) -> None:
        workflow = self.create_workflow(
            name="my_workflow",
            when_condition_group=self.create_data_condition_group(),
        )

        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SEER_RCA_STARTED.value,
        )
        data = build_activity_notification_data(
            activity=activity, target=self.target, workflow_id=workflow.id
        )

        assert isinstance(data, ActivityNotificationData)
        assert data.source == NotificationSource.ACTIVITY_SEER_RCA_STARTED
        assert data.activity_type == ActivityType.SEER_RCA_STARTED.value
        assert data.issue_short_id == self.group.qualified_short_id
        expected_issue_url = self.group.get_absolute_url(
            params={"seerDrawer": "true", "referrer": "activity_notification"}
        )
        assert absolute_uri(expected_issue_url) == data.issue_url
        assert data.issue_culprit == self.group.culprit
        assert data.project_url == self.organization.absolute_url(
            f"organizations/{self.organization.slug}/issues/",
            query=urlencode(
                {"project": self.project.id, "referrer": ACTIVITY_NOTIFICATION_REFERRER}
            ),
        )
        assert data.alert_url == self.organization.absolute_url(
            f"organizations/{self.organization.slug}/monitors/alerts/{workflow.id}/",
            query=urlencode({"referrer": ACTIVITY_NOTIFICATION_REFERRER}),
        )
        assert data.activity_data == activity.data
        assert data.user_settings_url == self.organization.absolute_url(
            "settings/account/notifications/alerts/",
            query=urlencode({"referrer": ACTIVITY_NOTIFICATION_REFERRER}),
        )
        assert data.email_headers is None
        assert data.email_subject_prefix == "[Sentry] "
        assert data.enhanced_privacy is False

    def test_build_activity_notification_data_enhanced_privacy(self) -> None:
        self.organization.flags.enhanced_privacy = True
        self.organization.save()
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
        )

        data = build_activity_notification_data(activity=activity, target=self.target)

        assert data.enhanced_privacy is True

    def test_build_subject_prefix(self) -> None:
        data = create_activity_notification_example(ActivityType.SET_RESOLVED)

        subject_prefix = build_subject_prefix(data)

        assert subject_prefix.type == NotificationTextBlockType.PLAIN_TEXT
        assert subject_prefix.text == "JAVASCRIPT-1 - ExampleError: something went wrong"

    def test_build_subject_prefix_enhanced_privacy(self) -> None:
        data = create_activity_notification_example(ActivityType.SET_RESOLVED).copy(
            update={"enhanced_privacy": True}
        )

        subject_prefix = build_subject_prefix(data)

        assert subject_prefix.type == NotificationTextBlockType.PLAIN_TEXT
        assert subject_prefix.text == "JAVASCRIPT-1"

    def test_build_activity_notification_data_user_settings_url_to_alerts(self) -> None:
        workflow = self.create_workflow(
            name="my_workflow",
            when_condition_group=self.create_data_condition_group(),
        )
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SEER_RCA_STARTED.value,
        )
        data = build_activity_notification_data(
            activity=activity, target=self.target, workflow_id=workflow.id
        )

        assert data.user_settings_url is not None
        assert "notifications/alerts/" in data.user_settings_url
        assert f"referrer={ACTIVITY_NOTIFICATION_REFERRER}" in data.user_settings_url

    def test_build_activity_notification_data_user_settings_url_to_workflow(self) -> None:
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SEER_RCA_STARTED.value,
        )
        data = build_activity_notification_data(activity=activity, target=self.target)

        assert data.user_settings_url is not None
        assert "notifications/workflow/" in data.user_settings_url
        assert f"referrer={ACTIVITY_NOTIFICATION_REFERRER}" in data.user_settings_url

    def test_build_activity_notification_data_user_settings_url_dm(self) -> None:
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SEER_RCA_STARTED.value,
        )
        target = GenericNotificationTarget(
            provider_key=NotificationProviderKey.SLACK,
            resource_type=NotificationTargetResourceType.DIRECT_MESSAGE,
            resource_id="U12345",
        )
        data = build_activity_notification_data(activity=activity, target=target)

        assert data.user_settings_url is not None
        assert "notifications/workflow/" in data.user_settings_url
        assert f"referrer={ACTIVITY_NOTIFICATION_REFERRER}" in data.user_settings_url

    def test_build_activity_notification_data_user_settings_url_channel_excluded(self) -> None:
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SEER_RCA_STARTED.value,
        )
        target = GenericNotificationTarget(
            provider_key=NotificationProviderKey.SLACK,
            resource_type=NotificationTargetResourceType.CHANNEL,
            resource_id="C12345",
        )
        data = build_activity_notification_data(activity=activity, target=target)

        assert data.user_settings_url is None

    @with_feature("organizations:issue-inbox")
    def test_build_activity_notification_data_seer_activity_inbox_url(self) -> None:
        activity = self.create_group_activity(
            group=self.group, type=ActivityType.SEER_RCA_STARTED.value
        )
        data = build_activity_notification_data(activity=activity, target=self.target)

        expected_inbox_url = self.organization.absolute_url(
            f"organizations/{self.organization.slug}/issues/inbox/",
            query=urlencode(
                {
                    "project": self.project.id,
                    "preview": self.group.id,
                    "referrer": "activity_notification",
                }
            ),
        )
        assert absolute_uri(expected_inbox_url) == data.issue_url

    @with_feature("organizations:issue-inbox")
    def test_build_activity_notification_data_non_seer_activity_uses_issue_url(self) -> None:
        activity = self.create_group_activity(
            group=self.group, type=ActivityType.SET_RESOLVED.value
        )
        data = build_activity_notification_data(activity=activity, target=self.target)

        expected_issue_url = self.group.get_absolute_url(
            params={"referrer": ACTIVITY_NOTIFICATION_REFERRER}
        )
        assert absolute_uri(expected_issue_url) == data.issue_url

    def test_build_activity_notification_data_sentry_app_user_name(self) -> None:
        sentry_app = self.create_internal_integration(name="Linear", organization=self.organization)
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            user_id=sentry_app.proxy_user_id,
        )
        data = build_activity_notification_data(activity=activity, target=self.target)

        assert data.activity_user_name == "Linear"

    def test_build_activity_notification_data_release_url_has_referrer(self) -> None:
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SET_RESOLVED_IN_RELEASE.value,
            data={"version": "1.2.3"},
        )
        data = build_activity_notification_data(activity=activity, target=self.target)

        assert isinstance(data, SetResolvedInReleaseNotificationData)
        assert data.release_url == self.organization.absolute_url(
            f"organizations/{self.organization.slug}/releases/1.2.3/",
            query=urlencode(
                {"project": self.project.id, "referrer": ACTIVITY_NOTIFICATION_REFERRER}
            ),
        )


class ActivitySeerAlertBaseTest(TestCase):
    def test_get_subject_with_qualified_short_id(self) -> None:
        data = create_activity_notification_example(ActivityType.SEER_RCA_STARTED)
        subject = get_subject("Root Cause Analysis Started", data)
        assert len(subject) == 2
        assert subject[0].text == "Root Cause Analysis Started for"
        assert subject[1].type == NotificationTextBlockType.CODE
        assert subject[1].text == "JAVASCRIPT-1"

    def test_get_subject_without_qualified_short_id(self) -> None:
        data = create_activity_notification_example(ActivityType.SEER_RCA_STARTED).copy(
            update={"issue_short_id": None}
        )
        subject = get_subject("Root Cause Analysis Started", data)
        assert len(subject) == 1
        assert "a Sentry Issue" in subject[0].text


class ActivitySetResolvedAlertBaseTest(TestCase):
    def test_get_status_change_subject_with_short_id(self) -> None:
        data = create_activity_notification_example(ActivityType.SET_RESOLVED)
        subject = get_status_change_subject(data)
        assert subject[0].type == NotificationTextBlockType.PLAIN_TEXT
        assert subject[0].text == "JAVASCRIPT-1 - ExampleError: something went wrong"
        assert "was resolved" in subject[1].text

    def test_get_status_change_subject_without_short_id(self) -> None:
        data = create_activity_notification_example(ActivityType.SET_RESOLVED).copy(
            update={"issue_short_id": None, "activity_user_name": None}
        )
        subject = get_status_change_subject(data)
        assert len(subject) == 2
        assert subject[0].text == "An Issue"
        assert subject[1].text == "was resolved"

    def test_get_status_change_subject_with_user(self) -> None:
        data = create_activity_notification_example(ActivityType.SET_RESOLVED)
        subject = get_status_change_subject(data)
        assert any(
            "by Jane Doe" in b.text
            for b in subject
            if b.type == NotificationTextBlockType.PLAIN_TEXT
        )


class ActivityAssignedAlertBaseTest(TestCase):
    def test_automated_assignment_subject(self) -> None:
        """Test that automated Sentry App assignments show 'auto-assigned' without proxy email"""
        data_dict = create_activity_notification_example(
            ActivityType.ASSIGNED,
            activity_data={
                "assignee": "123",
                "assigneeEmail": "user@example.com",
                "assigneeType": "user",
            },
        ).dict()

        # Simulate Sentry App automated assignment
        data_dict.update(
            {
                "activity_user_name": "sentry-0-issue-assigner-abc123-uuid@proxy-user.sentry.io",
                "is_automated": True,
            }
        )

        data = AssignedNotificationData(
            **data_dict,
            assignee_label="the workflows team",
            assignee_url=None,
        )

        subject = get_assigned_subject(data)
        subject_text = " ".join(b.text for b in subject)

        # Should say "auto-assigned" not show proxy email
        assert "auto-assigned" in subject_text
        assert "proxy-user.sentry.io" not in subject_text
        assert "the workflows team" in subject_text


@override_options({"notifications.platform.email-threading": True})
class ActivityEmailThreadingTest(TestCase):
    def setUp(self) -> None:
        self.email = "user@example.com"
        self.target = GenericNotificationTarget(
            provider_key=NotificationProviderKey.EMAIL,
            resource_type=NotificationTargetResourceType.EMAIL,
            resource_id=self.email,
        )
        self.group = self.create_group(project=self.project)
        self.activity = Activity.objects.create_group_activity(
            self.group,
            ActivityType.SET_RESOLVED,
            user=self.user,
            data={},
        )

    def _send_activity_email(self, mock_send_messages: mock.MagicMock) -> dict[str, str]:
        data = build_activity_notification_data(activity=self.activity, target=self.target)
        NotificationService(data=data).notify_target(
            target=self.target,
            threading_options=get_activity_email_threading_options(
                activity=self.activity, target=self.target
            ),
        )
        [sent_message] = mock_send_messages.call_args[0][0]
        return sent_message.extra_headers

    def test_threading_options_only_for_email(self) -> None:
        threading_options = get_activity_email_threading_options(
            activity=self.activity, target=self.target
        )
        assert threading_options is not None
        assert threading_options.thread_key.key_data == {"group_id": self.group.id}

        slack_target = IntegrationNotificationTarget(
            provider_key=NotificationProviderKey.SLACK,
            resource_type=NotificationTargetResourceType.CHANNEL,
            resource_id="C1234567890",
            integration_id=1,
            organization_id=self.organization.id,
        )
        assert (
            get_activity_email_threading_options(activity=self.activity, target=slack_target)
            is None
        )

    @override_options({"notifications.platform.email-threading": False})
    def test_threading_options_off(self) -> None:
        assert (
            get_activity_email_threading_options(activity=self.activity, target=self.target) is None
        )

    @mock.patch("sentry.notifications.platform.email.provider.send_messages")
    def test_replies_to_first_email(self, mock_send_messages: mock.MagicMock) -> None:
        first_headers = self._send_activity_email(mock_send_messages)
        root_message_id = first_headers["Message-Id"]
        assert "In-Reply-To" not in first_headers

        second_headers = self._send_activity_email(mock_send_messages)

        assert second_headers["In-Reply-To"] == root_message_id
        assert second_headers["References"] == root_message_id
        thread = NotificationThread.objects.get(target_id=self.email)
        assert thread.thread_identifier == root_message_id
        assert GroupEmailThread.objects.get(email=self.email, group=self.group).msgid == (
            root_message_id
        )

    @mock.patch("sentry.notifications.platform.email.provider.send_messages")
    def test_continues_legacy_thread(self, mock_send_messages: mock.MagicMock) -> None:
        legacy_message_id = "<legacy@example.com>"
        GroupEmailThread.objects.create(
            email=self.email, group=self.group, project=self.project, msgid=legacy_message_id
        )

        headers = self._send_activity_email(mock_send_messages)

        assert headers["In-Reply-To"] == legacy_message_id
        assert headers["References"] == legacy_message_id
        assert NotificationThread.objects.get(target_id=self.email).thread_identifier == (
            legacy_message_id
        )
