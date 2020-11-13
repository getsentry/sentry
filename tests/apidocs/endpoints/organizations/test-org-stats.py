# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.test.client import RequestFactory

from tests.apidocs.util import APIDocsTestCase


class OrganizationStatsDocs(APIDocsTestCase):
    def setUp(self):
        self.create_event("a", message="oh no")
        self.create_event("b", message="oh no")

        self.url = reverse(
            "sentry-api-0-organization-stats", kwargs={"organization_slug": self.organization.slug},
        )

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
