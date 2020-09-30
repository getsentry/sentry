# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.test.client import RequestFactory

from tests.apidocs.util import APIDocsTestCase


class OrganizationShortIDDocs(APIDocsTestCase):
    def setUp(self):
        self.create_event("a", message="oh no")
        group = self.group = self.create_group(project=self.project)
        self.url = reverse(
            "sentry-api-0-short-id-lookup",
            kwargs={"organization_slug": self.organization.slug, "short_id": group.short_id},
        )

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
