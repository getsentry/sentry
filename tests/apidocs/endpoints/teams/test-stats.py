# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.test.client import RequestFactory

from tests.apidocs.util import APIDocsTestCase


class TeamsStatsDocs(APIDocsTestCase):
    def setUp(self):
        team = self.create_team(organization=self.organization)
        self.create_project(name="foo", organization=self.organization, teams=[team])

        self.url = reverse(
            "sentry-api-0-team-stats",
            kwargs={"organization_slug": self.organization.slug, "team_slug": team.slug},
        )

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
