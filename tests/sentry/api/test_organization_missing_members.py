from datetime import timedelta

from django.utils import timezone

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
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

        self.login_as(self.user)

    def test_simple__common_domain(self):
        response = self.get_success_response(self.organization.slug)
        assert response.data[0]["integration"] == "github"
        assert response.data[0]["users"] == [
            {"email": "c@example.com", "externalId": "c", "commitCount": 2},
            {"email": "d@example.com", "externalId": "d", "commitCount": 1},
        ]

    def test_need_org_write(self):
        user = self.create_user()
        self.create_member(organization=self.organization, user=user, role="member")
        self.login_as(user)

        self.get_error_response(self.organization.slug, status=403)

    def test_filters_github_only(self):
        repo = self.create_repo(project=self.project, provider="integrations:bitbucket")
        self.create_commit(repo=repo, author=self.nonmember_commit_author1)

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

    def test_no_authors(self):
        org = self.create_organization(owner=self.create_user())
        self.create_member(user=self.user, organization=org, role="manager")

        response = self.get_success_response(org.slug)
        assert response.data[0]["integration"] == "github"
        assert response.data[0]["users"] == []

    def test_not_common_domain(self):
        self.create_member(
            organization=self.organization, user=self.create_user(email="owner@exampletwo.com")
        )
        not_common_domain_author = self.create_commit_author(
            project=self.project, email="a@exampletwo.com"
        )
        not_common_domain_author.external_id = "not"
        not_common_domain_author.save()
        self.create_commit(repo=self.repo, author=not_common_domain_author)

        response = self.get_success_response(self.organization.slug)

        assert response.data[0]["integration"] == "github"
        assert response.data[0]["users"] == [
            {"email": "c@example.com", "externalId": "c", "commitCount": 2},
            {"email": "d@example.com", "externalId": "d", "commitCount": 1},
            {"email": "a@exampletwo.com", "externalId": "not", "commitCount": 1},
        ]

    def test_query(self):
        nonmember_commit_author = self.create_commit_author(
            project=self.project, email="c2@example.com"
        )
        nonmember_commit_author.external_id = "c@example.com"
        nonmember_commit_author.save()

        self.create_commit(repo=self.repo, author=nonmember_commit_author)

        self.repo = self.create_repo(project=self.project, provider="integrations:github")
        self.create_commit(repo=self.repo, author=self.member_commit_author)

        response = self.get_success_response(self.organization.slug, query="c@example.com")

        assert response.data[0]["integration"] == "github"
        assert response.data[0]["users"] == [
            {"email": "c@example.com", "externalId": "c", "commitCount": 2},
            {"email": "c2@example.com", "externalId": "c@example.com", "commitCount": 1},
        ]
