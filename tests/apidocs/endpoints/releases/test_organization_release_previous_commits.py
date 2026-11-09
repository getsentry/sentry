from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.models.commit import Commit
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.repository import Repository


class OrganizationReleasePreviousCommitsDocsTest(APIDocsTestCase):
    def setUp(self) -> None:
        self.login_as(user=self.user)
        repo = Repository.objects.create(organization_id=self.organization.id, name="some/repo")
        previous = self.create_release(project=self.project, version="1.0.0")
        commit = Commit.objects.create(
            organization_id=self.organization.id, repository_id=repo.id, key="a" * 40
        )
        ReleaseCommit.objects.create(
            organization_id=self.organization.id, release=previous, commit=commit, order=0
        )
        Release.objects.filter(id=previous.id).update(last_commit_id=commit.id)

        release = self.create_release(project=self.project, version="2.0.0")
        self.url = reverse(
            "sentry-api-0-organization-release-previous-with-commits",
            kwargs={"organization_id_or_slug": self.organization.slug, "version": release.version},
        )

    def test_get(self) -> None:
        response = self.client.get(self.url)
        assert response.data["version"] == "1.0.0"
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)

    def test_get_without_previous_release(self) -> None:
        release = self.create_release(project=self.create_project(), version="3.0.0")
        url = reverse(
            "sentry-api-0-organization-release-previous-with-commits",
            kwargs={"organization_id_or_slug": self.organization.slug, "version": release.version},
        )
        response = self.client.get(url)
        assert response.data == {}
        request = RequestFactory().get(url)

        self.validate_schema(request, response)
