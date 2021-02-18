from django.core.urlresolvers import reverse
from django.test.client import RequestFactory

from sentry.testutils import SnubaTestCase
from tests.apidocs.util import APIDocsTestCase


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
        query = {"project": [self.project.id], "field": ["sum(session)"], "groupBy": ["release"]}

        request = RequestFactory().get(self.url)

        response = self.client.get(self.url, query)
        assert response.status_code == 200, response.content

        self.validate_schema(request, response)
