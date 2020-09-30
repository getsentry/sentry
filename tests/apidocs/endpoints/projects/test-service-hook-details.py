# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.test.client import RequestFactory

from tests.apidocs.util import APIDocsTestCase


class ProjectServiceHookDetailsDocs(APIDocsTestCase):
    def setUp(self):
        hook = self.create_service_hook(project=self.project, events=("event.created",))

        self.url = reverse(
            "sentry-api-0-project-service-hook-details",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project.slug,
                "hook_id": hook.id,
            },
        )

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)

    def test_put(self):
        data = {"url": "https://example.com/other-sentry-hook", "events": ["event.created"]}
        response = self.client.put(self.url, data)
        request = RequestFactory().put(self.url, data)

        self.validate_schema(request, response)
