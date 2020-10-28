# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.test.client import RequestFactory

from tests.apidocs.util import APIDocsTestCase


class ProjectEventsDocs(APIDocsTestCase):
    endpoint = "sentry-api-0-project-events"

    def setUp(self):
        self.create_event("a")
        self.create_event("b")

        self.url = reverse(
            self.endpoint,
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project.slug,
            },
        )

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
