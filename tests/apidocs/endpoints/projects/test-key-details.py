# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.test.client import RequestFactory

from tests.apidocs.util import APIDocsTestCase


class ProjectKeyDetailsDocs(APIDocsTestCase):
    def setUp(self):

        self.url = reverse(
            "sentry-api-0-project-key-details",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
                "key_id": self.projectkey.public_key,
            },
        )

        self.login_as(user=self.user)

    def test_put(self):
        data = {"name": "bar"}
        response = self.client.put(self.url, data)
        request = RequestFactory().put(self.url, data)

        self.validate_schema(request, response)
