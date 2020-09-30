# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.test.client import RequestFactory

from tests.apidocs.util import APIDocsTestCase


class OrganizationReposDocs(APIDocsTestCase):
    def setUp(self):
        organization = self.create_organization()
        project = self.create_project(name="foo", organization=organization, teams=[])
        self.create_repo(project=project, name="getsentry/sentry")

        self.url = reverse(
            "sentry-api-0-organization-repositories",
            kwargs={"organization_slug": organization.slug},
        )

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
