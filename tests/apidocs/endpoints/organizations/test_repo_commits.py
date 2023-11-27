from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationRepoCommitsDocs(APIDocsTestCase):
    def setUp(self):
        organization = self.create_organization(owner=self.user, name="Rowdy Tiger")
        project = self.create_project(name="foo", organization=organization, teams=[])
        repo = self.create_repo(project=project, name="getsentry/sentry")
        release = self.create_release(project=project)
        self.create_commit(project=project, repo=repo, release=release)

        self.url = reverse(
            "sentry-api-0-organization-repository-commits",
            kwargs={"organization_slug": organization.slug, "repo_id": repo.id},
        )

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
