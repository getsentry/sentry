from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import HelpPage
from sentry.testutils import APITestCase


class HelpPageListTest(APITestCase):
    def test_simple(self):
        HelpPage.objects.all().delete()
        page = HelpPage.objects.create(key='foo', title='Foo', content='bar')

        url = reverse('sentry-api-0-helppage-index')

        response = self.client.get(url)

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['id'] == str(page.id)
