# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.test.client import RequestFactory

from tests.apidocs.util import APIDocsTestCase


class TeamsBySlugDocs(APIDocsTestCase):
    def setUp(self):
        organization = self.create_organization()
        team = self.create_team(organization=self.organization)

        self.url = reverse(
            "sentry-api-0-team-details",
            kwargs={"organization_slug": organization.slug, "team_slug": team.slug},
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
