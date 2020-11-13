# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.test.client import RequestFactory

from tests.apidocs.util import APIDocsTestCase


class OrganizationUsersDocs(APIDocsTestCase):
    def setUp(self):
        self.owner_user = self.create_user("foo@localhost", username="foo")
        self.user_2 = self.create_user("bar@localhost", username="bar")

        self.org = self.create_organization(owner=self.owner_user)
        self.org.member_set.create(user=self.user_2)
        self.team = self.create_team(organization=self.org, members=[self.owner_user, self.user_2])
        self.project = self.create_project(teams=[self.team])

        self.login_as(user=self.user_2)
        self.url = reverse(
            "sentry-api-0-organization-users", kwargs={"organization_slug": self.org.slug},
        )

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
