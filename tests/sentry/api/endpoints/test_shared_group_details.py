from __future__ import absolute_import, print_function

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class SharedGroupDetailsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        group = self.create_group()
        event = self.create_event(group=group)

        url = reverse('sentry-api-0-shared-group-details', kwargs={
            'share_id': group.get_share_id(),
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == str(group.id)
        assert response.data['latestEvent']['id'] == str(event.id)
