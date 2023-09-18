from unittest.mock import patch

from sentry.constants import ObjectStatus
from sentry.models.options.organization_option import OrganizationOption
from sentry.tasks.invite_missing_org_members import schedule_organizations, send_nudge_email
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
@patch(
    "sentry.notifications.notifications.missing_members_nudge.MissingMembersNudgeNotification.send",
)
@patch(
    "sentry.tasks.invite_missing_org_members.send_nudge_email",
)
class InviteMissingMembersTestCase(TestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user(email="owner@example.com")
        self.organization = self.create_organization(owner=self.user)
        self.create_member(
            email="a@example.com",
            organization=self.organization,
        )
        member = self.create_member(user=self.create_user(), organization=self.organization)
        member.user_email = "b@example.com"
        member.save()

        self.member_commit_author = self.create_commit_author(
            project=self.project, email="b@example.com"
        )
        self.nonmember_commit_author1 = self.create_commit_author(
            project=self.project, email="c@example.com"
        )
        self.nonmember_commit_author1.external_id = "c"
        self.nonmember_commit_author1.save()

        self.nonmember_commit_author2 = self.create_commit_author(
            project=self.project, email="d@example.com"
        )
        self.nonmember_commit_author2.external_id = "d"
        self.nonmember_commit_author2.save()

        self.repo = self.create_repo(project=self.project, provider="integrations:github")
        self.create_commit(repo=self.repo, author=self.member_commit_author)
        self.create_commit(repo=self.repo, author=self.nonmember_commit_author1)
        self.create_commit(repo=self.repo, author=self.nonmember_commit_author1)
        self.create_commit(repo=self.repo, author=self.nonmember_commit_author2)

        not_shared_domain_author = self.create_commit_author(
            project=self.project, email="a@exampletwo.com"
        )
        not_shared_domain_author.external_id = "not"
        not_shared_domain_author.save()
        self.create_commit(repo=self.repo, author=not_shared_domain_author)

        self.login_as(self.user)

    @with_feature("organizations:integrations-gh-invite")
    def test_schedules_and_sends(self, mock_send_email, mock_send_notification):
        integration = self.create_integration(
            organization=self.organization, provider="github", name="Github", external_id="github:1"
        )
        self.repo.integration_id = integration.id
        self.repo.save()

        with self.tasks():
            schedule_organizations()

        mock_send_email.delay.assert_called_with(self.organization.id)

        send_nudge_email(org_id=self.organization.id)

        assert mock_send_notification.called

    def test_no_github_repos(self, mock_send_email, mock_send_notification):
        self.repo.delete()

        with self.tasks():
            schedule_organizations()

        assert not mock_send_email.delay.called

    def test_no_active_github_repos(self, mock_send_email, mock_send_notification):
        self.repo.status = ObjectStatus.DISABLED
        self.repo.save()

        with self.tasks():
            schedule_organizations()

        assert not mock_send_email.delay.called

    def test_missing_org(self, mock_send_email, mock_send_notification):
        send_nudge_email(org_id=0)

        assert not mock_send_notification.called

    def test_missing_feature_flag(self, mock_send_email, mock_send_notification):
        send_nudge_email(org_id=self.organization.id)

        assert not mock_send_notification.called

    @with_feature("organizations:integrations-gh-invite")
    def test_missing_integration(self, mock_send_email, mock_send_notification):
        send_nudge_email(org_id=self.organization.id)

        assert not mock_send_notification.called

    @with_feature("organizations:integrations-gh-invite")
    def test_missing_option(self, mock_send_email, mock_send_notification):
        OrganizationOption.objects.set_value(
            organization=self.organization, key="sentry:github_nudge_invite", value=False
        )

        integration = self.create_integration(
            organization=self.organization, provider="github", name="Github", external_id="github:1"
        )
        self.repo.integration_id = integration.id
        self.repo.save()

        send_nudge_email(org_id=self.organization.id)

        assert not mock_send_notification.called

    @with_feature("organizations:integrations-gh-invite")
    def test_missing_nonmember_commit_authors(self, mock_send_email, mock_send_notification):
        org = self.create_organization()
        project = self.create_project(organization=org)
        self.create_repo(project=project, provider="github")

        self.create_integration(
            organization=org, provider="github", name="Github", external_id="github:1"
        )

        send_nudge_email(org_id=org.id)

        assert not mock_send_notification.called
