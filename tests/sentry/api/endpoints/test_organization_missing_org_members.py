from datetime import timedelta

from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.models.organizationmember import OrganizationMember
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test


@region_silo_test
class OrganizationMissingMembersTestCase(APITestCase):
    endpoint = "sentry-api-0-organization-missing-members"
    method = "get"

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
        self.nonmember_commit_author1.external_id = "github:c"
        self.nonmember_commit_author1.save()

        self.nonmember_commit_author2 = self.create_commit_author(
            project=self.project, email="d@example.com"
        )
        self.nonmember_commit_author2.external_id = "github:d"
        self.nonmember_commit_author2.save()

        nonmember_commit_author_invalid_char = self.create_commit_author(
            project=self.project, email="hi+1@example.com"
        )
        nonmember_commit_author_invalid_char.external_id = "github:hi+1"
        nonmember_commit_author_invalid_char.save()

        nonmember_commit_author_invalid_domain = self.create_commit_author(
            project=self.project, email="gmail@gmail.com"
        )
        nonmember_commit_author_invalid_domain.external_id = "github:gmail"
        nonmember_commit_author_invalid_domain.save()

        self.integration = self.create_integration(
            organization=self.organization, provider="github", name="Github", external_id="github:1"
        )
        self.integration2 = self.create_integration(
            organization=self.organization,
            provider="github",
            name="Github2",
            external_id="github:3",
        )
        self.repo = self.create_repo(
            project=self.project, provider="integrations:github", integration_id=self.integration.id
        )
        self.create_commit(repo=self.repo, author=self.member_commit_author)
        self.create_commit(repo=self.repo, author=self.nonmember_commit_author1)
        self.create_commit(repo=self.repo, author=self.nonmember_commit_author1)
        self.create_commit(repo=self.repo, author=self.nonmember_commit_author2)
        self.create_commit(repo=self.repo, author=nonmember_commit_author_invalid_char)
        self.create_commit(repo=self.repo, author=nonmember_commit_author_invalid_domain)

        not_shared_domain_author = self.create_commit_author(
            project=self.project, email="a@exampletwo.com"
        )
        not_shared_domain_author.external_id = "github:not"
        not_shared_domain_author.save()
        self.create_commit(repo=self.repo, author=not_shared_domain_author)

        self.invited_member = self.create_member(
            email="invited@example.com",
            organization=self.organization,
        )
        self.invited_member.user_email = "invited@example.com"
        self.invited_member.save()
        self.invited_member_commit_author = self.create_commit_author(
            project=self.project, email="invited@example.com"
        )
        self.invited_member_commit_author.external_id = "github:invited"
        self.invited_member_commit_author.save()
        self.create_commit(repo=self.repo, author=self.invited_member_commit_author)

        self.login_as(self.user)

    def test_shared_domain_filter(self):
        # only returns users with example.com emails (shared domain)

        response = self.get_success_response(self.organization.slug)
        assert response.data[0]["integration"] == "github"
        assert response.data[0]["users"] == [
            {"email": "c@example.com", "externalId": "c", "commitCount": 2},
            {"email": "d@example.com", "externalId": "d", "commitCount": 1},
        ]

    def test_requires_org_write(self):
        user = self.create_user()
        self.create_member(organization=self.organization, user=user, role="member")
        self.login_as(user)

        self.get_error_response(self.organization.slug, status=403)

    def test_filters_github_only(self):
        repo = self.create_repo(project=self.project, provider="integrations:bitbucket")
        self.create_commit(repo=repo, author=self.nonmember_commit_author1)
        self.create_integration(
            organization=self.organization, provider="bitbucket", external_id="bitbucket:1"
        )

        response = self.get_success_response(self.organization.slug)
        assert response.data[0]["integration"] == "github"
        assert response.data[0]["users"] == [
            {"email": "c@example.com", "externalId": "c", "commitCount": 2},
            {"email": "d@example.com", "externalId": "d", "commitCount": 1},
        ]

    def test_filters_old_commits(self):
        self.create_commit(
            repo=self.repo,
            author=self.nonmember_commit_author1,
            date_added=timezone.now() - timedelta(days=31),
        )

        response = self.get_success_response(self.organization.slug)
        assert response.data[0]["integration"] == "github"
        assert response.data[0]["users"] == [
            {"email": "c@example.com", "externalId": "c", "commitCount": 2},
            {"email": "d@example.com", "externalId": "d", "commitCount": 1},
        ]

    def test_filters_authors_with_no_external_id(self):
        no_external_id_author = self.create_commit_author(
            project=self.project, email="e@example.com"
        )
        self.create_commit(
            repo=self.repo,
            author=no_external_id_author,
        )

        response = self.get_success_response(self.organization.slug)
        assert response.data[0]["integration"] == "github"
        assert response.data[0]["users"] == [
            {"email": "c@example.com", "externalId": "c", "commitCount": 2},
            {"email": "d@example.com", "externalId": "d", "commitCount": 1},
        ]

    def test_no_authors(self):
        org = self.create_organization(owner=self.create_user())
        self.create_member(user=self.user, organization=org, role="manager")
        self.create_integration(
            organization=org, provider="github", name="Github", external_id="github:2"
        )

        response = self.get_success_response(org.slug)
        assert response.data[0]["integration"] == "github"
        assert response.data[0]["users"] == []

    def test_owners_filters_with_different_domains(self):
        user = self.create_user(email="owner@exampletwo.com")
        self.create_member(
            organization=self.organization,
            user=user,
            role="owner",
        )

        # this user has an email domain that is filtered
        noreply_email_author = self.create_commit_author(
            project=self.project, email="hi@noreply.github.com"
        )
        noreply_email_author.external_id = "github:hi"
        noreply_email_author.save()
        self.create_commit(
            repo=self.repo,
            author=noreply_email_author,
        )

        response = self.get_success_response(self.organization.slug)

        assert response.data[0]["integration"] == "github"
        assert response.data[0]["users"] == [
            {"email": "c@example.com", "externalId": "c", "commitCount": 2},
            {"email": "d@example.com", "externalId": "d", "commitCount": 1},
            {"email": "a@exampletwo.com", "externalId": "not", "commitCount": 1},
        ]

    def test_owners_invalid_domain_no_filter(self):
        OrganizationMember.objects.filter(role="owner", organization=self.organization).update(
            user_email="example"
        )

        response = self.get_success_response(self.organization.slug)
        assert response.data[0]["users"] == [
            {"email": "c@example.com", "externalId": "c", "commitCount": 2},
            {"email": "d@example.com", "externalId": "d", "commitCount": 1},
            {"email": "a@exampletwo.com", "externalId": "not", "commitCount": 1},
        ]

    def test_excludes_empty_owner_emails(self):
        # ignores this second owner with an empty email

        user = self.create_user(email="")
        self.create_member(
            organization=self.organization,
            user=user,
            role="owner",
        )

        response = self.get_success_response(self.organization.slug)

        assert response.data[0]["integration"] == "github"
        assert response.data[0]["users"] == [
            {"email": "c@example.com", "externalId": "c", "commitCount": 2},
            {"email": "d@example.com", "externalId": "d", "commitCount": 1},
        ]

    def test_no_github_integration(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.delete()
            self.integration2.delete()

        response = self.get_success_response(self.organization.slug)
        assert len(response.data) == 0

    def test_disabled_integration(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.status = ObjectStatus.DISABLED
            self.integration.save()
            self.integration2.status = ObjectStatus.DISABLED
            self.integration2.save()

        response = self.get_success_response(self.organization.slug)
        assert len(response.data) == 0

    def test_nongithub_integration(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.delete()
            self.integration2.delete()

        integration = self.create_integration(
            organization=self.organization,
            provider="bitbucket",
            name="Bitbucket",
            external_id="bitbucket:1",
        )
        repo = self.create_repo(
            project=self.project, provider="integrations:github", integration_id=integration.id
        )
        self.create_commit(repo=repo, author=self.member_commit_author)
        self.create_commit(repo=repo, author=self.nonmember_commit_author1)
        self.create_commit(repo=repo, author=self.nonmember_commit_author1)
        self.create_commit(repo=repo, author=self.nonmember_commit_author2)

        response = self.get_success_response(self.organization.slug)
        assert len(response.data) == 0

    def test_filters_disabled_github_integration(self):
        integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="Github",
            external_id="github:2",
            status=ObjectStatus.DISABLED,
        )
        repo = self.create_repo(
            project=self.project, provider="integrations:github", integration_id=integration.id
        )
        self.create_commit(repo=repo, author=self.member_commit_author)
        self.create_commit(repo=repo, author=self.nonmember_commit_author1)
        self.create_commit(repo=repo, author=self.nonmember_commit_author1)
        self.create_commit(repo=repo, author=self.nonmember_commit_author2)

        response = self.get_success_response(self.organization.slug)
        assert response.data[0]["integration"] == "github"
        assert response.data[0]["users"] == [
            {"email": "c@example.com", "externalId": "c", "commitCount": 2},
            {"email": "d@example.com", "externalId": "d", "commitCount": 1},
        ]

    def test_limit_50_missing_members(self):
        repo = self.create_repo(
            project=self.project, provider="integrations:github", integration_id=self.integration.id
        )
        for i in range(50):
            nonmember_commit_author = self.create_commit_author(
                project=self.project, email=str(i) + "@example.com"
            )
            nonmember_commit_author.external_id = "github:" + str(i)
            nonmember_commit_author.save()
            self.create_commit(repo=repo, author=nonmember_commit_author)

        response = self.get_success_response(self.organization.slug)
        assert len(response.data[0]["users"]) == 50
