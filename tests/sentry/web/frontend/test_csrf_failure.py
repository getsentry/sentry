from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import TestCase


class CsrfFailureTest(TestCase):
    urls = 'sentry.conf.urls'

    def test_simple(self):
        path = reverse('error-403-csrf-failure')

        resp = self.client.get(path)
        assert resp.status_code == 403
        self.assertTemplateUsed(resp, 'sentry/403-csrf-failure.html')
