from sentry.models import Commit, Release, ReleaseCommit, ReleaseProject, Repository
from sentry.testutils import APITestCase


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
