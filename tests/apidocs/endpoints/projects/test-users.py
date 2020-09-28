# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.test.client import RequestFactory

from tests.apidocs.util import APIDocsTestCase


class ProjectUsersDocs(APIDocsTestCase):
    def setUp(self):
        organization = self.create_organization()
        project = self.create_project(name="foo", organization=organization, teams=[])

        self.url = reverse(
            "sentry-api-0-project-users",
            kwargs={"organization_slug": organization.slug, "project_slug": project.slug},
        )

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
