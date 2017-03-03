from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import TestCase


class Error500Test(TestCase):
    urls = 'sentry.conf.urls'

    def test_renders(self):
        resp = self.client.get(reverse('error-500'))
        assert resp.status_code == 500
        self.assertTemplateUsed(resp, 'sentry/500.html')
