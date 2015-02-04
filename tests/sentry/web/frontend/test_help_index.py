from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import TestCase


class HelpIndexTest(TestCase):
    def test_simple(self):
        path = reverse('sentry-help')

        resp = self.client.get(path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/help/index.html')
