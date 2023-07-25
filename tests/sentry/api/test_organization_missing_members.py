from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class OrganizationMissingMembersTestCase(APITestCase):
    endpoint = "sentry-api-0-organization-missing-members"
    method = "get"

    def setUp(self):
        super().setUp()

        self.create_member(
            email="a@example.com",
            organization=self.organization,
        )
        member = self.create_member(user=self.create_user(), organization=self.organization)
        member.user_email = "b@example.com"
        member.save()

        self.commit_author = self.create_commit_author(project=self.project, email="b@example.com")
        self.commit_author1 = self.create_commit_author(project=self.project, email="c@example.com")
        self.commit_author1.external_id = "c"
        self.commit_author1.save()

        self.commit_author2 = self.create_commit_author(project=self.project, email="d@example.com")
        self.commit_author2.external_id = "d"
        self.commit_author2.save()

        self.repo = self.create_repo(project=self.project, provider="integrations:github")
        self.create_commit(repo=self.repo, author=self.commit_author)
        self.create_commit(repo=self.repo, author=self.commit_author1)
        self.create_commit(repo=self.repo, author=self.commit_author1)
        self.create_commit(repo=self.repo, author=self.commit_author2)

        self.login_as(self.user)

    def test_simple(self):
        response = self.get_success_response(self.organization.slug)
        assert response.data[0]["integration"] == "github"
        assert response.data[0]["users"] == [
            {"email": "c@example.com", "externalId": "c", "commitCount": 2},
            {"email": "d@example.com", "externalId": "d", "commitCount": 1},
        ]
