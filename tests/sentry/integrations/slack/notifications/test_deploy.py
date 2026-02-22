import orjson
from django.utils import timezone

from sentry.models.activity import Activity
from sentry.models.deploy import Deploy
from sentry.notifications.notifications.activity.release import ReleaseActivityNotification
from sentry.testutils.cases import SlackActivityNotificationTest
from sentry.types.activity import ActivityType


class SlackDeployNotificationTest(SlackActivityNotificationTest):
    def test_deploy_block(self) -> None:
        """
        Test that a Slack message is sent with the expected payload when a deploy happens.
        and block kit is enabled.
        """
        release = self.create_release(
            version="meow" * 10,
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

        blocks = orjson.loads(self.mock_post.call_args.kwargs["blocks"])
        fallback_text = self.mock_post.call_args.kwargs["text"]
        assert (
            fallback_text
            == f"Release {release.version} was deployed to {self.environment.name} for these projects"
        )
        assert blocks[0]["text"]["text"] == fallback_text

        for i in range(len(projects)):
            project = SLUGS_TO_PROJECT[blocks[2]["elements"][i]["text"]["text"]]
            assert (
                blocks[2]["elements"][i]["url"]
                == f"http://testserver/organizations/{self.organization.slug}/releases/"
                f"{release.version}/?project={project.id}&unselectedSeries=Healthy&referrer=release_activity&notification_uuid={notification.notification_uuid}"
            )
            assert blocks[2]["elements"][i]["value"] == "link_clicked"

        # footer references the notification's project
        footer_text = blocks[1]["elements"][0]["text"]
        footer_slug = footer_text.split(" | ")[0]
        assert footer_slug in SLUGS_TO_PROJECT
        assert (
            footer_text
            == f"{footer_slug} | <http://testserver/settings/account/notifications/deploy/?referrer=release_activity-slack-user&notification_uuid={notification.notification_uuid}|Notification Settings>"
        )
