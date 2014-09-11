from django.core.urlresolvers import reverse

from sentry.testutils import TestCase


class HelpIndexTest(TestCase):
    def test_simple(self):
        path = reverse('sentry-help')

        resp = self.client.get(path)
        assert resp.status_code == 200
