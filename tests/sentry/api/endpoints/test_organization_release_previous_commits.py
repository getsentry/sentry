from __future__ import absolute_import
from django.core.urlresolvers import reverse

from sentry.models import (
    Commit,
    Release,
    ReleaseCommit,
    Repository,
)
from sentry.testutils import APITestCase


class OrganizationReleasePreviousCommitsTest(APITestCase):
    def setUp(self):
        self.user = self.create_user(is_staff=False, is_superuser=False)

        project = self.create_project(organization=self.organization)
        self.project2 = self.create_project(organization=self.organization)

        repo = Repository.objects.create(organization_id=project.organization_id, name="some/repo")

        # previous releases
        release = Release.objects.create(organization_id=self.organization.id, version="abcabcabc")
        release.add_project(project)
        commit = Commit.objects.create(
            organization_id=project.organization_id, repository_id=repo.id, key="12345678"
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

        Release.objects.filter(version="abcabcabc").update(last_commit_id=commit2.id)

        self.release_with_commit = release

        release2 = Release.objects.create(organization_id=self.organization.id, version="12345678")
        release2.add_project(self.project2)

        new_release = Release.objects.create(
            organization_id=self.organization.id, version="newnewnew"
        )
        new_release.add_project(project)
        new_release.add_project(self.project2)
        self.url = reverse(
            "sentry-api-0-organization-release-previous-with-commits",
            kwargs={"organization_slug": self.organization.slug, "version": new_release.version},
        )

    def test_previous_release_has_commits(self):
        self.login_as(user=self.user)

        response = self.client.get(self.url)

        assert response.status_code == 200, response.content
        assert response.data["version"] == self.release_with_commit.version

    def test_no_previous_release_with_commit(self):
        self.login_as(user=self.user)
        new_release = Release.objects.create(
            organization_id=self.organization.id, version="123123123"
        )
        new_release.add_project(self.project2)
        url = reverse(
            "sentry-api-0-organization-release-previous-with-commits",
            kwargs={"organization_slug": self.organization.slug, "version": new_release.version},
        )
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert response.content == b"{}"

    def test_wrong_release_version(self):
        self.login_as(user=self.user)
        release = Release.objects.create(organization_id=self.organization.id, version="456456456")

        url = reverse(
            "sentry-api-0-organization-release-previous-with-commits",
            kwargs={"organization_slug": self.organization.slug, "version": release.version},
        )

        response = self.client.get(url)
        assert response.status_code == 404, response.content
