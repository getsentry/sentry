from django.core.urlresolvers import reverse

from sentry.testutils import TestCase


class HelpPlatformDetailsTest(TestCase):
    def test_simple(self):
        path = reverse('sentry-help-platform', args=['python'])

        resp = self.client.get(path)
        assert resp.status_code == 200
        assert resp.context['platform'] == 'python'
