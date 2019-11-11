from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.test import override_settings

from sentry.testutils import TestCase


@override_settings(ROOT_URLCONF="sentry.conf.urls")
class Error404Test(TestCase):
    def test_renders(self):
        resp = self.client.get(reverse("error-404"))
        assert resp.status_code == 404
        self.assertTemplateUsed(resp, "sentry/404.html")
