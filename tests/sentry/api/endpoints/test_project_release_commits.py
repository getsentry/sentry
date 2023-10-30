from sentry.constants import ObjectStatus
from sentry.models.commit import Commit
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.repository import Repository
from sentry.testutils.cases import APITestCase


class ReleaseCommitsListTest(APITestCase):
    endpoint = "sentry-api-0-project-release-commits"

    def setUp(self):
        super().setUp()

        self.project = self.create_project(name="foo")
        self.release = Release.objects.create(
            organization_id=self.project.organization_id, version="1"
        )
        self.release.add_project(self.project)
        self.repo = Repository.objects.create(
            organization_id=self.project.organization_id,
            name=self.project.name,
            external_id=123,
        )
        Repository.objects.create(
            organization_id=self.project.organization_id,
            name=self.project.name,
            status=ObjectStatus.HIDDEN,
            external_id=123,
        )
        self.commit = Commit.objects.create(
            organization_id=self.project.organization_id, repository_id=self.repo.id, key="a" * 40
        )
        self.commit2 = Commit.objects.create(
            organization_id=self.project.organization_id, repository_id=self.repo.id, key="b" * 40
        )
        ReleaseCommit.objects.create(
            organization_id=self.project.organization_id,
            release=self.release,
            commit=self.commit,
            order=1,
        )
        ReleaseCommit.objects.create(
            organization_id=self.project.organization_id,
            release=self.release,
            commit=self.commit2,
            order=0,
        )

        self.login_as(user=self.user)

    def test_simple(self):
        response = self.get_success_response(
            self.project.organization.slug, self.project.slug, self.release.version
        )

        assert len(response.data) == 2
        assert response.data[0]["id"] == self.commit2.key
        assert response.data[1]["id"] == self.commit.key

    def test_query_name(self):
        response = self.get_success_response(
            self.project.organization.slug,
            self.project.slug,
            self.release.version,
            qs_params={"repo_name": self.repo.name},
        )

        assert len(response.data) == 2
        assert response.data[0]["id"] == self.commit2.key
        assert response.data[1]["id"] == self.commit.key

    def test_query_external_id(self):
        response = self.get_success_response(
            self.project.organization.slug,
            self.project.slug,
            self.release.version,
            qs_params={"repo_id": self.repo.external_id},
        )

        assert len(response.data) == 2
        assert response.data[0]["id"] == self.commit2.key
        assert response.data[1]["id"] == self.commit.key

    def test_query_does_not_exist(self):
        self.get_error_response(
            self.project.organization.slug,
            self.project.slug,
            self.release.version,
            status_code=404,
            qs_params={"repo_name": "hello"},
        )

        self.get_error_response(
            self.project.organization.slug,
            self.project.slug,
            self.release.version,
            status_code=404,
            qs_params={"repo_id": "0"},
        )
