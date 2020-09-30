# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.test.client import RequestFactory

from tests.apidocs.util import APIDocsTestCase


class ProjectDsymsDocs(APIDocsTestCase):
    def setUp(self):
        self.url = reverse(
            "sentry-api-0-dsym-files",
            kwargs={"organization_slug": self.organization.slug, "project_slug": self.project.slug},
        )

        self.login_as(user=self.user)

    def test_get(self):
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)

    def test_post(self):

        dif = self.create_dif_file(
            debug_id="dfb8e43a-f242-3d73-a453-aeb6a777ef75", features=["debug", "unwind"]
        )
        data = {"file": dif.file}
        response = self.client.post(self.url, data, content_type="multipart/form-data")
        request = RequestFactory().post(self.url, data)

        self.validate_schema(request, response)
