from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import TestCase


class Error404Test(TestCase):
    urls = 'sentry.conf.urls'

    def test_renders(self):
        resp = self.client.get(reverse('error-404'))
        assert resp.status_code == 404
        self.assertTemplateUsed(resp, 'sentry/404.html')
