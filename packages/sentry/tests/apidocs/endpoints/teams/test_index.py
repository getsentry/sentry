from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase


class TeamsIndexDocs(APIDocsTestCase):
    def setUp(self):
        self.create_team(organization=self.organization)

        self.url = reverse(
            "sentry-api-0-organization-teams",
            kwargs={"organization_slug": self.organization.slug},
        )

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)

    def test_post(self):
        data = {"name": "foo"}
        response = self.client.post(self.url, data)
        request = RequestFactory().post(self.url, data)

        self.validate_schema(request, response)
