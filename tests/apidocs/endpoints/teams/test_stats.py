from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase


class TeamsStatsDocs(APIDocsTestCase):
    def setUp(self):

        self.team = self.create_team(organization=self.organization, members=[self.user])
        self.project.add_team(self.team)

        self.create_event("a", message="oh no")
        self.create_event("b", message="oh my")

        self.url = reverse(
            "sentry-api-0-team-stats",
            kwargs={"organization_slug": self.organization.slug, "team_slug": self.team.slug},
        )

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
