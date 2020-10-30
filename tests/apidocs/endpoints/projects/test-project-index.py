# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.test.client import RequestFactory

from tests.apidocs.util import APIDocsTestCase


class ProjectIndexDocs(APIDocsTestCase):
    def setUp(self):
        self.org = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.org, members=[self.user])
        self.project = self.create_project(teams=[self.team])

        self.login_as(user=self.user)
        self.url = reverse("sentry-api-0-projects")

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
