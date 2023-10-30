from unittest import skip
from unittest.mock import MagicMock, Mock, patch

from django.utils import timezone

from sentry.models.activity import Activity
from sentry.models.deploy import Deploy
from sentry.notifications.notifications.activity.release import ReleaseActivityNotification
from sentry.testutils.cases import MSTeamsActivityNotificationTest
from sentry.types.activity import ActivityType


@patch(
    "sentry.integrations.msteams.MsTeamsClientMixin.get_user_conversation_id",
    Mock(return_value="some_conversation_id"),
)
@patch("sentry.integrations.msteams.MsTeamsClientMixin.send_card")
class MSTeamsDeployNotificationTest(MSTeamsActivityNotificationTest):
    @skip("Flaky test")
    def test_deploy(self, mock_send_card: MagicMock):
        """
        Test that the card for MS Teams notification is generated correctly when a deployment is created.
        """
        projects = [self.project, self.create_project(name="battlesnake")]
        release = self.create_release(
            project=projects[0],
            additional_projects=projects[1:],
            version="meow",
            date_released=timezone.now(),
        )

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

        mock_send_card.assert_called_once()

        args, kwargs = mock_send_card.call_args

        assert args[0] == "some_conversation_id"

        body = args[1]["body"]
        assert 2 == len(body)

        assert (
            f"Release {release.version} was deployed to {self.environment.name} for these projects"
        )

        actions = args[1]["actions"]
        assert len(projects) == len(actions)

        SLUGS_TO_PROJECT = {project.slug: project for project in projects}
        first_project = None
        for i in range(len(projects)):
            project = SLUGS_TO_PROJECT[actions[i]["title"]]
            if not first_project:
                first_project = project
            assert (
                actions[i]["url"]
                == f"http://testserver/organizations/{self.organization.slug}/releases/"
                f"{release.version}/?project={project.id}&unselectedSeries=Healthy/"
            )
        assert first_project is not None

        assert (
            f"{first_project.slug} | [Notification Settings](http://testserver/settings/account/notifications/deploy/?referrer=release\\_activity-msteams-user)"
            == body[1]["columns"][1]["items"][0]["text"]
        )
