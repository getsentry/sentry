from sentry.constants import ObjectStatus
from sentry.models import Commit, Release, ReleaseCommit, Repository
from sentry.models.commitfilechange import CommitFileChange
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class CommitFileChangeTest(APITestCase):
    endpoint = "sentry-api-0-release-commitfilechange"

    def setUp(self):
        super().setUp()

        self.project = self.create_project(name="foo")
        self.release = Release.objects.create(
            organization_id=self.project.organization_id, version="1"
        )
        self.release.add_project(self.project)
        self.repo = Repository.objects.create(
            organization_id=self.project.organization_id, name=self.project.name
        )
        Repository.objects.create(
            organization_id=self.project.organization_id,
            name=self.project.name,
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
            commit=commit,
            filename=".gitignore",
            type="M",
        )
        CommitFileChange.objects.create(
            organization_id=self.project.organization_id,
            commit=commit2,
            filename="/static/js/widget.js",
            type="A",
        )

        self.login_as(user=self.user)

    def test_simple(self):
        response = self.get_success_response(self.project.organization.slug, self.release.version)

        assert len(response.data) == 2
        assert response.data[0]["filename"] == ".gitignore"
        assert response.data[1]["filename"] == "/static/js/widget.js"

    def test_query_name(self):
        response = self.get_success_response(
            self.project.organization.slug,
            self.release.version,
            qs_params={"repo_name": self.repo.name},
        )

        assert response.data[0]["filename"] == ".gitignore"
        assert response.data[1]["filename"] == "/static/js/widget.js"
