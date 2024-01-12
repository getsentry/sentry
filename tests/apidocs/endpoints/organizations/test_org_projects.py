from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationProjectsDocs(APIDocsTestCase):
    def setUp(self):
        organization = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.create_project(name="foo", organization=organization, teams=[])
        self.create_project(name="bar", organization=organization, teams=[])

        self.url = reverse(
            "sentry-api-0-organization-projects",
            kwargs={"organization_slug": organization.slug},
        )

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
