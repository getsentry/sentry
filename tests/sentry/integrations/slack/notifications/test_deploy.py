from unittest import mock

import responses
from django.utils import timezone

from sentry.models.activity import Activity
from sentry.models.deploy import Deploy
from sentry.models.release import Release
from sentry.notifications.notifications.activity.release import ReleaseActivityNotification
from sentry.testutils.cases import SlackActivityNotificationTest
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.slack import get_attachment, send_notification
from sentry.testutils.silo import region_silo_test
from sentry.types.activity import ActivityType


@region_silo_test(stable=True)
class SlackDeployNotificationTest(SlackActivityNotificationTest):
    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
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
                user_id=self.user.id,
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
        notification_uuid = self.get_notification_uuid(attachment["actions"][0]["url"])
        for i in range(len(projects)):
            project = SLUGS_TO_PROJECT[attachment["actions"][i]["text"]]
            if not first_project:
                first_project = project
            assert (
                attachment["actions"][i]["url"]
                == f"http://testserver/organizations/{self.organization.slug}/releases/"
                f"{release.version}/?project={project.id}&unselectedSeries=Healthy&referrer=release_activity&notification_uuid={notification_uuid}"
            )
        assert first_project is not None

        assert (
            attachment["footer"]
            == f"{first_project.slug} | <http://testserver/settings/account/notifications/"
            f"deploy/?referrer=release_activity-slack-user&notification_uuid={notification_uuid}|Notification Settings>"
        )

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    @with_feature("organizations:notification-settings-v2")
    def test_deploy_v2(self, mock_func):
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
                user_id=self.user.id,
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
        notification_uuid = self.get_notification_uuid(attachment["actions"][0]["url"])
        for i in range(len(projects)):
            project = SLUGS_TO_PROJECT[attachment["actions"][i]["text"]]
            if not first_project:
                first_project = project
            assert (
                attachment["actions"][i]["url"]
                == f"http://testserver/organizations/{self.organization.slug}/releases/"
                f"{release.version}/?project={project.id}&unselectedSeries=Healthy&referrer=release_activity&notification_uuid={notification_uuid}"
            )
        assert first_project is not None

        assert (
            attachment["footer"]
            == f"{first_project.slug} | <http://testserver/settings/account/notifications/"
            f"deploy/?referrer=release_activity-slack-user&notification_uuid={notification_uuid}|Notification Settings>"
        )
