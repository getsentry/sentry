from unittest import mock, skip

import responses
from django.utils import timezone

from sentry.models import Activity, Deploy, Release
from sentry.notifications.notifications.activity import ReleaseActivityNotification
from sentry.testutils.cases import SlackActivityNotificationTest
from sentry.testutils.helpers.slack import get_attachment, send_notification
from sentry.types.activity import ActivityType


class SlackDeployNotificationTest(SlackActivityNotificationTest):
    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    @skip("Test is flaky")
    def test_deploy(self, mock_func):
        """
        Test that a Slack message is sent with the expected payload when a deploy happens.
        """
        release = Release.objects.create(
            version="meow" * 10,
            organization_id=self.project.organization_id,
            date_released=timezone.now(),
        )

        # The projects can appear out of order.
        projects = (self.project, self.create_project(name="battlesnake"))
        SLUGS_TO_PROJECT = {project.slug: project for project in projects}

        for project in projects:
            release.add_project(project)

        deploy = Deploy.objects.create(
            release=release,
            organization_id=self.organization.id,
            environment_id=self.environment.id,
        )
        notification = ReleaseActivityNotification(
            Activity(
                project=self.project,
                user=self.user,
                type=ActivityType.RELEASE.value,
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

        first_project = None
        for i in range(len(projects)):
            project = SLUGS_TO_PROJECT[attachment["actions"][i]["text"]]
            if not first_project:
                first_project = project
            assert (
                attachment["actions"][i]["url"]
                == f"http://testserver/organizations/{self.organization.slug}/releases/"
                f"{release.version}/?project={project.id}&unselectedSeries=Healthy/"
            )

        assert (
            attachment["footer"]
            == f"{first_project.slug} | <http://testserver/settings/account/notifications/"
            f"deploy/?referrer=release_activity-slack-user|Notification Settings>"
        )
