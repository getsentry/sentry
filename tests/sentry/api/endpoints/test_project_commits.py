from django.urls import reverse

from sentry.models.commit import Commit
from sentry.models.release import Release, ReleaseProject
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.repository import Repository
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ProjectCommitListTest(APITestCase):
    endpoint = "sentry-api-0-project-commits"

    def test_simple(self):
        project = self.create_project(name="komal")
        version = "1.1"
        repo = Repository.objects.create(organization_id=project.organization_id, name=project.name)
        release = Release.objects.create(organization_id=project.organization_id, version=version)
        commit = self.create_commit(repo=repo, project=project, key="a" * 40, release=release)
        ReleaseProject.objects.create(project=project, release=release)

        self.login_as(user=self.user)

        response = self.get_success_response(project.organization.slug, project.slug)
        assert [r["id"] for r in response.data] == [commit.key]

    def test_duplicate_released_commits(self):
        project = self.create_project(name="komal")
        repo = Repository.objects.create(organization_id=project.organization_id, name=project.name)
        release = Release.objects.create(organization_id=project.organization_id, version="1.1")
        release2 = Release.objects.create(organization_id=project.organization_id, version="1.2")
        ReleaseProject.objects.create(project=project, release=release)

        commit = Commit.objects.create(
            organization_id=project.organization_id, repository_id=repo.id, key="a" * 40
        )

        ReleaseCommit.objects.create(
            organization_id=project.organization_id,
            release=release,
            commit=commit,
            order=0,
            project_id=project.id,
        )

        ReleaseCommit.objects.create(
            organization_id=project.organization_id,
            release=release2,
            commit=commit,
            order=0,
            project_id=project.id,
        )

        self.login_as(user=self.user)

        response = self.get_success_response(project.organization.slug, project.slug)
        assert len(response.data) == 1

    def test_query_filter(self):
        project = self.create_project(name="komal")
        version = "1.1"
        repo = Repository.objects.create(organization_id=project.organization_id, name=project.name)
        release = Release.objects.create(organization_id=project.organization_id, version=version)
        self.create_commit(repo=repo, project=project, key="foobar", release=release)
        ReleaseProject.objects.create(project=project, release=release)

        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-project-commits",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        response = self.client.get(url + "?query=foobar", format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1

        response = self.client.get(url + "?query=random", format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 0

        response = self.client.get(url + "?query=foob", format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1

        response = self.client.get(url + "?query=f", format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1

        response = self.client.get(url + "?query=ooba", format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 0
