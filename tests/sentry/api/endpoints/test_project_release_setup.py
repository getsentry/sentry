from django.urls import reverse

from sentry.models.commit import Commit
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.repository import Repository
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ProjectReleaseSetupCompletionTest(APITestCase):
    def test_simple(self):
        project = self.create_project()
        release = self.create_release(project, self.user)
        self.create_group(project=project, first_release=release)

        repo = Repository.objects.create(organization_id=project.organization_id, name=project.name)

        commit = Commit.objects.create(
            organization_id=project.organization_id, repository_id=repo.id, key="b" * 40
        )

        ReleaseCommit.objects.create(
            organization_id=project.organization_id, release=release, commit=commit, order=0
        )

        url = reverse(
            "sentry-api-0-project-releases-completion-status",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        self.login_as(user=self.user)

        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 4
        assert response.data[2]["step"] == "commit"
        assert response.data[2]["complete"] is True
        assert response.data[3]["step"] == "deploy"
        assert response.data[3]["complete"] is False

    def test_commit_different_project(self):
        project = self.create_project()
        other_project = self.create_project()

        organization_id = project.organization_id

        release = self.create_release(project)
        other_release = self.create_release(other_project)

        self.create_group(project=project, first_release=release)

        other_repo = Repository.objects.create(
            organization_id=organization_id, name=other_project.name
        )
        other_commit = Commit.objects.create(
            organization_id=organization_id, repository_id=other_repo.id, key="b" * 40
        )

        ReleaseCommit.objects.create(
            organization_id=organization_id, release=other_release, commit=other_commit, order=0
        )
        assert ReleaseCommit.objects.filter(release__projects=project).count() == 0

        url = reverse(
            "sentry-api-0-project-releases-completion-status",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        self.login_as(user=self.user)

        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert response.data[2]["step"] == "commit"
        assert response.data[2]["complete"] is False
