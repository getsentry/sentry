from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase


class TeamsBySlugDocs(APIDocsTestCase):
    def setUp(self):
        team = self.create_team(organization=self.organization)

        self.url = reverse(
            "sentry-api-0-team-details",
            kwargs={"organization_slug": self.organization.slug, "team_slug": team.slug},
        )

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)

    def test_put(self):
        data = {"name": "foo"}
        response = self.client.put(self.url, data)
        request = RequestFactory().put(self.url, data)

        self.validate_schema(request, response)
