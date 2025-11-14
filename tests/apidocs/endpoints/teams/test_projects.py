from typing import int
from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase


class TeamsProjectsDocs(APIDocsTestCase):
    def setUp(self) -> None:
        team = self.create_team(organization=self.organization)
        self.create_project(name="foo", organization=self.organization, teams=[team])

        self.url = reverse(
            "sentry-api-0-team-project-index",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "team_id_or_slug": team.slug,
            },
        )

        self.login_as(user=self.user)

    def test_get(self) -> None:
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
