from django.urls import reverse

from sentry.models import Commit, Release, ReleaseCommit, ReleaseProject, Repository
from sentry.testutils import APITestCase


class ProjectCommitListTest(APITestCase):
    def test_simple(self):
        project = self.create_project(name="komal")
        version = "1.1"
        repo = Repository.objects.create(organization_id=project.organization_id, name=project.name)
        release = Release.objects.create(organization_id=project.organization_id, version=version)
        commit = self.create_commit(repo=repo, project=project, key="a" * 40, release=release)
        ReleaseProject.objects.create(project=project, release=release)

        url = reverse(
            "sentry-api-0-project-commits",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        self.login_as(user=self.user)
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == commit.key

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

        url = reverse(
            "sentry-api-0-project-commits",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        self.login_as(user=self.user)
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
