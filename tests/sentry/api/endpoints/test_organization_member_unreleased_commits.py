from datetime import datetime, timezone

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationMemberUnreleasedCommitsTest(APITestCase):
    endpoint = "sentry-api-0-organization-member-unreleased-commits"

    def test_simple(self):
        repo = self.create_repo(self.project)
        repo2 = self.create_repo(self.project)

        # we first need to create a release attached to a repository, or that repository
        # will never be included
        release = self.create_release(self.project)
        author = self.create_commit_author(project=self.project, user=self.user)

        # note: passing 'release' to create_commit causes it to bind ReleaseCommit
        self.create_commit(
            project=self.project,
            repo=repo,
            release=release,
            author=author,
            date_added=datetime(2015, 1, 1, tzinfo=timezone.utc),
        )

        # create a commit associated with an unreleased repo -- which should not appear
        self.create_commit(
            project=self.project,
            repo=repo2,
            author=author,
            date_added=datetime(2015, 1, 2, tzinfo=timezone.utc),
        )

        # create several unreleased commits associated with repo
        unreleased_commit = self.create_commit(
            project=self.project,
            repo=repo,
            author=author,
            date_added=datetime(2015, 1, 2, tzinfo=timezone.utc),
        )
        unreleased_commit2 = self.create_commit(
            project=self.project,
            repo=repo,
            author=author,
            date_added=datetime(2015, 1, 3, tzinfo=timezone.utc),
        )
        self.create_commit(
            project=self.project,
            repo=repo,
            date_added=datetime(2015, 1, 3, tzinfo=timezone.utc),
        )

        self.login_as(self.user)

        response = self.get_success_response(self.organization.slug, "me")

        assert len(response.data["commits"]) == 2
        assert response.data["commits"][0]["id"] == unreleased_commit2.key
        assert response.data["commits"][1]["id"] == unreleased_commit.key
        assert len(response.data["repositories"]) == 1
        assert str(repo.id) in response.data["repositories"]
