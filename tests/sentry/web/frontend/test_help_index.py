from django.core.urlresolvers import reverse

from sentry.models import HelpPage
from sentry.testutils import TestCase


class HelpIndexTest(TestCase):
    def test_simple(self):
        page1 = HelpPage.objects.create(
            title='foo',
            content='bar',
            priority=50,
        )
        page2 = HelpPage.objects.create(
            title='foo',
            content='bar',
            priority=100,
        )
        page3 = HelpPage.objects.create(
            title='foo',
            content='bar',
            priority=100,
            is_visible=False,
        )

        path = reverse('sentry-help')

        resp = self.client.get(path)
        assert resp.status_code == 200
        assert resp.context['page_list'] == [
            page2,
            page1,
        ]
