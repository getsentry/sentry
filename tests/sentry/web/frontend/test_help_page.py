from django.core.urlresolvers import reverse

from sentry.models import HelpPage
from sentry.testutils import TestCase


class HelpPageTest(TestCase):
    def test_simple(self):
        page = HelpPage.objects.create(
            title='foo',
            content='bar',
            is_visible=True,
        )

        path = reverse('sentry-help-page', args=[page.id, page.slug])

        resp = self.client.get(path)

        assert resp.status_code == 200

    def test_hidden_page(self):
        page = HelpPage.objects.create(
            title='foo',
            content='bar',
            is_visible=False,
        )

        path = reverse('sentry-help-page', args=[page.id, page.slug])

        resp = self.client.get(path)

        assert resp.status_code == 404

        self.login_as(self.user)

        resp = self.client.get(path)

        assert resp.status_code == 200
