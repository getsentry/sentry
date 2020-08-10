# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import TestCase


class DocsRedirectTest(TestCase):
    def test_response(self):
        path = reverse("sentry-docs-redirect")
        resp = self.client.get(path)
        assert resp["Location"] == "https://docs.sentry.io/"
        assert resp.status_code == 302, resp.status_code


class ApiDocsRedirectTest(TestCase):
    def test_response(self):
        path = reverse("sentry-api-docs-redirect")
        resp = self.client.get(path)
        assert resp["Location"] == "https://docs.sentry.io/api/"
        assert resp.status_code == 302, resp.status_code
