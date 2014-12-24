from django.core.urlresolvers import reverse

from sentry.testutils import TestCase


class HelpPlatformIndexTest(TestCase):
    def test_simple(self):
        path = reverse('sentry-help-platform-list')

        resp = self.client.get(path)
        assert resp.status_code == 200
