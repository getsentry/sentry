from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.models import Broadcast, BroadcastSeen
from sentry.testutils import APITestCase


class BroadcastListTest(APITestCase):
    def test_simple(self):
        broadcast1 = Broadcast.objects.create(message='bar', is_active=True)
        Broadcast.objects.create(message='foo', is_active=False)

        self.login_as(user=self.user)
        url = reverse('sentry-api-0-broadcast-index')
        response = self.client.get(url)
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(broadcast1.id)


class BroadcastUpdateTest(APITestCase):
    def test_simple(self):
        broadcast1 = Broadcast.objects.create(message='bar', is_active=True)
        broadcast2 = Broadcast.objects.create(message='foo', is_active=False)

        self.login_as(user=self.user)
        url = reverse('sentry-api-0-broadcast-index')
        response = self.client.put(url, {
            'hasSeen': '1'
        })
        assert response.status_code == 200
        assert response.data['hasSeen']

        assert BroadcastSeen.objects.filter(
            user=self.user,
            broadcast=broadcast1,
        ).exists()
        assert not BroadcastSeen.objects.filter(
            user=self.user,
            broadcast=broadcast2,
        ).exists()
