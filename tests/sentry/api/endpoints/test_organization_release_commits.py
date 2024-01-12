from django.urls import reverse

from sentry.models.commit import Commit
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.repository import Repository
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ReleaseCommitsListTest(APITestCase):
    def test_simple(self):
        project = self.create_project(name="foo")
        release = Release.objects.create(organization_id=project.organization_id, version="1")
        release.add_project(project)
        repo = Repository.objects.create(organization_id=project.organization_id, name=project.name)
        commit = Commit.objects.create(
            organization_id=project.organization_id, repository_id=repo.id, key="a" * 40
        )
        commit2 = Commit.objects.create(
            organization_id=project.organization_id, repository_id=repo.id, key="b" * 40
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id, release=release, commit=commit, order=1
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id, release=release, commit=commit2, order=0
        )
        url = reverse(
            "sentry-api-0-organization-release-commits",
            kwargs={"organization_slug": project.organization.slug, "version": release.version},
        )

        self.login_as(user=self.user)

        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0]["id"] == commit2.key
        assert response.data[1]["id"] == commit.key
