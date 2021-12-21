from unittest import mock

import responses
from django.utils import timezone

from sentry.models import Activity, Deploy, Release
from sentry.notifications.notifications.activity import ReleaseActivityNotification
from sentry.testutils.cases import SlackActivityNotificationTest
from sentry.testutils.helpers.slack import get_attachment, send_notification


class SlackUnassignedNotificationTest(SlackActivityNotificationTest):
    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_deploy(self, mock_func):
        """
        Test that a Slack message is sent with the expected payload when a deploy happens
        """
        release = Release.objects.create(
            version="meow" * 10,
            organization_id=self.project.organization_id,
            date_released=timezone.now(),
        )
        project2 = self.create_project(name="battlesnake")
        release.add_project(self.project)
        release.add_project(project2)
        deploy = Deploy.objects.create(
            release=release,
            organization_id=self.organization.id,
            environment_id=self.environment.id,
        )
        notification = ReleaseActivityNotification(
            Activity(
                project=self.project,
                user=self.user,
                type=Activity.RELEASE,
                data={"version": release.version, "deploy_id": deploy.id},
            )
        )
        with self.tasks():
            notification.send()

        attachment, text = get_attachment()
        assert (
            text
            == f"Release {release.version} was deployed to {self.environment.name} for these projects"
        )
        assert attachment["actions"][0]["text"] == self.project.slug
        assert (
            attachment["actions"][0]["url"]
            == f"http://testserver/organizations/{self.organization.slug}/releases/{release.version}/?project={self.project.id}&unselectedSeries=Healthy/"
        )
        assert attachment["actions"][1]["text"] == project2.slug
        assert (
            attachment["actions"][1]["url"]
            == f"http://testserver/organizations/{self.organization.slug}/releases/{release.version}/?project={project2.id}&unselectedSeries=Healthy/"
        )
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/deploy/?referrer=release-activity-slack-user|Notification Settings>"
        )
