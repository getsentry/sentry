from urllib.parse import quote

from django.core import mail

from sentry.models import Activity, Environment, Repository
from sentry.notifications.notifications.activity.release_summary import (
    ReleaseSummaryActivityNotification,
)
from sentry.notifications.types import GroupSubscriptionReason
from sentry.services.hybrid_cloud.user import user_service
from sentry.testutils.cases import ActivityTestCase
from sentry.types.activity import ActivityType
from sentry.types.integrations import ExternalProviders
from sentry.utils.http import absolute_uri


class ReleaseSummaryTestCase(ActivityTestCase):
    def setUp(self):
        super().setUp()

        self.org = self.create_organization(owner=None)
        self.org.flags.allow_joinleave = False
        self.org.save()

        self.team = self.create_team(organization=self.org)
        self.team2 = self.create_team(organization=self.org)

        self.user1 = self.another_user("user1@example.com", self.team)
        self.user2 = self.another_user("user2@example.com")

        self.project = self.create_project(organization=self.org, teams=[self.team])
        self.project2 = self.create_project(organization=self.org, teams=[self.team2])

        self.environment = Environment.objects.create(
            name="production", organization_id=self.org.id
        )

        self.release, self.deploy = self.another_release("a")

        repository = Repository.objects.create(organization_id=self.org.id, name=self.project.name)

        # The commits are intentionally out of order to test commit `order`.
        self.commit1 = self.another_commit(0, "a", self.user1, repository)
        self.commit2 = self.another_commit(1, "b", self.user2, repository)

    def test_simple(self):
        with self.feature("organizations:active-release-notifications-enable"):
            release_summary = ReleaseSummaryActivityNotification(
                Activity(
                    project=self.project,
                    user=self.user1,
                    type=ActivityType.DEPLOY.value,
                    data={"version": self.release.version, "deploy_id": self.deploy.id},
                )
            )

        # user1 is included because they committed
        participants = release_summary.get_participants_with_group_subscription_reason()[
            ExternalProviders.EMAIL
        ]
        assert len(participants) == 1
        assert participants == {
            self.user1: GroupSubscriptionReason.committed,
        }

        context = release_summary.get_context()
        assert context["environment"] == "production"

        user_context = release_summary.get_recipient_context(
            user_service.serialize_user(self.user1), {}
        )
        # make sure this only includes projects user has access to
        assert len(user_context["projects"]) == 1
        assert user_context["projects"][0][0] == self.project

        with self.tasks():
            release_summary.send()

        assert len(mail.outbox) == 1

        sent_email_addresses = {msg.to[0] for msg in mail.outbox}

        assert sent_email_addresses == {self.user1.email}

        release_link = absolute_uri(
            f"/organizations/{self.org.slug}/releases/{quote(self.release.version)}/?referrer=release_summary&project={self.project.id}"
        )
        issues_link = absolute_uri(
            f"/organizations/{self.org.slug}/issues/?query={quote(f'firstRelease:{self.release.version}')}&project={self.project.id}&referrer=release_summary"
        )

        slack_message = release_summary.get_notification_title(ExternalProviders.SLACK)
        assert (
            slack_message
            == f"Release <{release_link}|aaaaaaaaaaaa> has been deployed to production for an hour with <{issues_link}|0 issues> associated with it"
        )
