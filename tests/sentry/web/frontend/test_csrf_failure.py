from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.test import override_settings

from sentry.testutils import TestCase


@override_settings(ROOT_URLCONF="sentry.conf.urls")
class CsrfFailureTest(TestCase):
    def test_simple(self):
        path = reverse("error-403-csrf-failure")

        resp = self.client.get(path)
        assert resp.status_code == 403
        self.assertTemplateUsed(resp, "sentry/403-csrf-failure.html")
