from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.testutils.cases import SnubaTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationSessionsDocsTest(APIDocsTestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()

        self.organization = self.create_organization(owner=self.user, name="foo")
        self.project = self.create_project(name="bar", organization=self.organization, teams=[])

        self.url = reverse(
            "sentry-api-0-organization-sessions",
            kwargs={"organization_slug": self.organization.slug},
        )

        self.login_as(user=self.user)

    def test_get(self):
        query = {
            "project": [self.project.id],
            "statsPeriod": "30d",
            "field": ["sum(session)"],
            "groupBy": ["release"],
        }

        request = RequestFactory().get(self.url)

        response = self.client.get(self.url, query)
        assert response.status_code == 200, response.content

        self.validate_schema(request, response)
