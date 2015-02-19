from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import HelpPage
from sentry.testutils import APITestCase


class HelpPageDetailsTest(APITestCase):
    def test_simple(self):
        page = HelpPage.objects.create(key='foo', title='Foo', content='bar')

        url = reverse('sentry-api-0-helppage-details', kwargs={
            'page_id': page.id,
        })

        response = self.client.get(url)

        assert response.status_code == 200
        assert response.data['id'] == str(page.id)
        assert response.data['content'] == 'bar'
