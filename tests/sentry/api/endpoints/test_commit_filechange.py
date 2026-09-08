from sentry.constants import ObjectStatus
from sentry.models.commit import Commit
from sentry.models.commitfilechange import CommitFileChange
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.repository import Repository
from sentry.testutils.cases import APITestCase


class CommitFileChangeTest(APITestCase):
    endpoint = "sentry-api-0-release-commitfilechange"

    def setUp(self) -> None:
        super().setUp()

        self.project = self.create_project(name="foo")
        self.release = Release.objects.create(
            organization_id=self.project.organization_id, version="1"
        )
        self.release.add_project(self.project)
        self.repo = Repository.objects.create(
            organization_id=self.project.organization_id, name=self.project.name, external_id=123
        )
        Repository.objects.create(
            organization_id=self.project.organization_id,
            name=self.project.name,
            external_id=123,
            status=ObjectStatus.HIDDEN,
        )
        commit = Commit.objects.create(
            organization_id=self.project.organization_id, repository_id=self.repo.id, key="a" * 40
        )
        commit2 = Commit.objects.create(
            organization_id=self.project.organization_id, repository_id=self.repo.id, key="b" * 40
        )
        ReleaseCommit.objects.create(
            organization_id=self.project.organization_id,
            release=self.release,
            commit=commit,
            order=1,
        )
        ReleaseCommit.objects.create(
            organization_id=self.project.organization_id,
            release=self.release,
            commit=commit2,
            order=0,
        )
        CommitFileChange.objects.create(
            organization_id=self.project.organization_id,
            commit_id=commit.id,
            filename=".gitignore",
            type="M",
        )
        CommitFileChange.objects.create(
            organization_id=self.project.organization_id,
            commit_id=commit2.id,
            filename="/static/js/widget.js",
            type="A",
        )

        self.login_as(user=self.user)

    def test_simple(self) -> None:
        response = self.get_success_response(self.project.organization.slug, self.release.version)

        assert len(response.data) == 2
        assert response.data[0]["filename"] == ".gitignore"
        assert response.data[1]["filename"] == "/static/js/widget.js"

    def test_query_name(self) -> None:
        response = self.get_success_response(
            self.project.organization.slug,
            self.release.version,
            qs_params={"repo_name": self.repo.name},
        )

        assert response.data[0]["filename"] == ".gitignore"
        assert response.data[1]["filename"] == "/static/js/widget.js"

    def test_query_external_id(self) -> None:
        response = self.get_success_response(
            self.project.organization.slug,
            self.release.version,
            qs_params={"repo_id": self.repo.external_id},
        )

        assert response.data[0]["filename"] == ".gitignore"
        assert response.data[1]["filename"] == "/static/js/widget.js"

    def test_query_does_not_exist(self) -> None:
        self.get_error_response(
            self.project.organization.slug,
            self.release.version,
            status_code=404,
            qs_params={"repo_name": "hello"},
        )

        self.get_error_response(
            self.project.organization.slug,
            self.release.version,
            status_code=404,
            qs_params={"repo_id": "0"},
        )

    def test_query_external_id_ignores_other_provider(self) -> None:
        # External ids are only unique per provider: another provider's repo with the same
        # id has no commits in this release and must not shadow the release's repo.
        self.create_repo(
            project=self.project,
            name="other/repo",
            provider="integrations:gitlab",
            external_id="123",
        )
        response = self.get_success_response(
            self.project.organization.slug,
            self.release.version,
            qs_params={"repo_id": "123"},
        )

        assert len(response.data) == 2

    def test_query_external_id_with_duplicate_repos(self) -> None:
        newest_repo = self.create_repo(
            project=self.project,
            name="relinked/repo",
            provider="integrations:gitlab",
            external_id="123",
        )
        commit = self.create_commit(repo=newest_repo, key="c" * 40)
        self.create_release_commit(release=self.release, commit=commit, order=2)
        response = self.get_success_response(
            self.project.organization.slug,
            self.release.version,
            qs_params={"repo_id": "123"},
        )

        assert {change["filename"] for change in response.data} == set(
            CommitFileChange.objects.filter(commit_id=commit.id).values_list("filename", flat=True)
        )

    def test_query_external_id_repo_without_release_commits(self) -> None:
        self.create_repo(project=self.project, name="other/repo", external_id="456")
        self.get_error_response(
            self.project.organization.slug,
            self.release.version,
            status_code=404,
            qs_params={"repo_id": "456"},
        )
