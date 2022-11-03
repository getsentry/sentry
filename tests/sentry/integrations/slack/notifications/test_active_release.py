from datetime import timedelta
from unittest import mock

import responses
from django.utils import timezone

from sentry.models import GroupRelease, NotificationSetting, Release, Rule
from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.rules.processor import RuleProcessor
from sentry.testutils.cases import SlackActivityNotificationTest
from sentry.testutils.helpers.slack import get_attachment, send_notification
from sentry.testutils.silo import region_silo_test
from sentry.types.integrations import ExternalProviders


@region_silo_test
class SlackIssueAlertNotificationTest(SlackActivityNotificationTest):
    def setUp(self):
        super().setUp()
        Rule.objects.filter(project=self.event.project).delete()
        self.event = next(self.event.build_group_events())
        self.event.group._times_seen_pending = 0
        self.event.group.save()
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ACTIVE_RELEASE,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
        )
        self.newRelease = Release.objects.create(
            organization_id=self.organization.id,
            version="2",
            date_added=timezone.now() - timedelta(minutes=30),
            date_released=timezone.now() - timedelta(minutes=30),
        )
        GroupRelease.objects.create(
            project_id=self.project.id,
            group_id=self.event.group.id,
            release_id=self.newRelease.id,
            first_seen=timezone.now(),
            last_seen=timezone.now(),
        )
        self.newRelease.add_project(self.project)
        self.event.data["tags"] = (("sentry:release", self.newRelease.version),)

    @responses.activate
    @mock.patch("sentry.notifications.utils.participants.get_release_committers")
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_no_notify(self, mock_func, mock_get_release_committers):
        mock_get_release_committers.return_value = [self.user]
        with self.tasks():
            rp = RuleProcessor(
                self.event,
                is_new=True,
                is_regression=False,
                is_new_group_environment=True,
                has_reappeared=False,
            )
            results = list(rp.apply())
            assert len(results) == 0
            assert len(responses.calls) == 0

    @responses.activate
    @mock.patch("sentry.notifications.utils.participants.get_release_committers")
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_notify_user(self, mock_func, mock_get_release_committers):
        mock_get_release_committers.return_value = [self.user]
        with self.tasks(), self.feature("organizations:active-release-notifications-enable"):
            rp = RuleProcessor(
                self.event,
                is_new=True,
                is_regression=False,
                is_new_group_environment=True,
                has_reappeared=False,
            )
            results = list(rp.apply())
            assert len(results) == 0

            attachment, text = get_attachment()

            assert "has a new issue" in attachment["title"]
            assert (
                attachment["footer"]
                == f"{self.project.slug} | <http://testserver/settings/account/notifications/activeRelease/?referrer=release_issue_alert-slack-user|Notification Settings>"
            )
            assert text == "Active Release alert triggered"
