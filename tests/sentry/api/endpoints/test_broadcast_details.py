from __future__ import absolute_import

import six

from sentry.models import Broadcast, BroadcastSeen
from sentry.testutils import APITestCase


class BroadcastDetailsTest(APITestCase):
    def test_simple(self):
        broadcast1 = Broadcast.objects.create(message="bar", is_active=True)
        Broadcast.objects.create(message="foo", is_active=False)

        self.login_as(user=self.user)

        response = self.client.get(u"/api/0/broadcasts/{}/".format(broadcast1.id))
        assert response.status_code == 200
        assert response.data["id"] == six.text_type(broadcast1.id)


class BroadcastUpdateTest(APITestCase):
    def test_regular_user(self):
        broadcast1 = Broadcast.objects.create(message="bar", is_active=True)
        broadcast2 = Broadcast.objects.create(message="foo", is_active=False)

        self.add_user_permission(user=self.user, permission="broadcasts.admin")
        self.login_as(user=self.user)

        response = self.client.put(
            u"/api/0/broadcasts/{}/".format(broadcast1.id), {"hasSeen": "1", "message": "foobar"}
        )
        assert response.status_code == 200
        assert response.data["hasSeen"]

        assert BroadcastSeen.objects.filter(user=self.user, broadcast=broadcast1).exists()
        assert not BroadcastSeen.objects.filter(user=self.user, broadcast=broadcast2).exists()
        broadcast1 = Broadcast.objects.get(id=broadcast1.id)
        assert broadcast1.message == "bar"
        broadcast2 = Broadcast.objects.get(id=broadcast2.id)
        assert broadcast2.message == "foo"

    def test_superuser(self):
        broadcast1 = Broadcast.objects.create(message="bar", is_active=True)
        broadcast2 = Broadcast.objects.create(message="foo", is_active=False)

        self.add_user_permission(user=self.user, permission="broadcasts.admin")
        self.login_as(user=self.user, superuser=True)

        response = self.client.put(
            u"/api/0/broadcasts/{}/".format(broadcast1.id), {"hasSeen": "1", "message": "foobar"}
        )
        assert response.status_code == 200
        assert response.data["hasSeen"]

        assert BroadcastSeen.objects.filter(user=self.user, broadcast=broadcast1).exists()
        assert not BroadcastSeen.objects.filter(user=self.user, broadcast=broadcast2).exists()
        broadcast1 = Broadcast.objects.get(id=broadcast1.id)
        assert broadcast1.message == "foobar"
        broadcast2 = Broadcast.objects.get(id=broadcast2.id)
        assert broadcast2.message == "foo"
