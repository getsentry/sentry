from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone

from sentry.models import Activity, Environment, Repository
from sentry.tasks.release_summary import prepare_release_summary
from sentry.testutils.cases import ActivityTestCase
from sentry.types.activity import ActivityType


class SendReleaseSummaryTest(ActivityTestCase):
    def setUp(self):
        super().setUp()

        self.org = self.create_organization(owner=None)

        self.team = self.create_team(organization=self.org)
        self.team2 = self.create_team(organization=self.org)
        self.user1 = self.another_user("user1@example.com", self.team)
        self.project = self.create_project(organization=self.org, teams=[self.team])
        self.project2 = self.create_project(organization=self.org, teams=[self.team2])
        self.environment = Environment.objects.create(
            name="production", organization_id=self.org.id
        )

        self.release, self.deploy = self.another_release("a")

        # Update deploy too look like it has run Deploy.notify_if_ready
        deployed_at = timezone.now() - timedelta(hours=1, minutes=1)
        self.deploy.update(date_finished=deployed_at, notified=True)
        Activity.objects.create(
            type=ActivityType.DEPLOY.value,
            project=self.release.projects.first(),
            ident=Activity.get_version_ident(self.release.version),
            data={
                "version": self.release.version,
                "deploy_id": self.deploy.id,
                "environment": self.environment.name,
            },
            datetime=deployed_at,
        )

        repository = Repository.objects.create(organization_id=self.org.id, name=self.project.name)
        self.commit1 = self.another_commit(0, "a", self.user1, repository)

    @patch(
        "sentry.notifications.notifications.activity.release_summary.ReleaseSummaryActivityNotification.send"
    )
    def test_simple(self, mock_release_summary_send):
        with self.feature("organizations:active-release-notifications-enable"):
            prepare_release_summary()

        assert len(mock_release_summary_send.mock_calls) == 1

    @patch(
        "sentry.notifications.notifications.activity.release_summary.ReleaseSummaryActivityNotification.send"
    )
    def test_without_feature_flag(self, mock_release_summary_send):
        prepare_release_summary()

        assert not mock_release_summary_send.mock_calls
