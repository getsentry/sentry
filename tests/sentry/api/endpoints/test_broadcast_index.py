from __future__ import absolute_import

import six

from sentry.models import Broadcast, BroadcastSeen
from sentry.testutils import APITestCase


class BroadcastListTest(APITestCase):
    def test_simple(self):
        broadcast1 = Broadcast.objects.create(message="bar", is_active=True)
        Broadcast.objects.create(message="foo", is_active=False)

        self.add_user_permission(user=self.user, permission="broadcasts.admin")
        self.login_as(user=self.user)

        response = self.client.get("/api/0/broadcasts/")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == six.text_type(broadcast1.id)

    def test_superuser_with_all(self):
        Broadcast.objects.create(message="bar", is_active=True)
        Broadcast.objects.create(message="foo", is_active=False)

        self.add_user_permission(user=self.user, permission="broadcasts.admin")
        self.login_as(user=self.user, superuser=True)

        response = self.client.get("/api/0/broadcasts/?show=all")
        assert response.status_code == 200
        assert len(response.data) == 2

        response = self.client.get("/api/0/broadcasts/?show=all&query=status:active")
        assert response.status_code == 200
        assert len(response.data) == 1

        response = self.client.get("/api/0/broadcasts/?show=all&query=status:inactive")
        assert response.status_code == 200
        assert len(response.data) == 1

        response = self.client.get("/api/0/broadcasts/?show=all&query=status:zzz")
        assert response.status_code == 200
        assert len(response.data) == 0

        response = self.client.get("/api/0/broadcasts/?show=all&query=foo")
        assert response.status_code == 200
        assert len(response.data) == 1

        response = self.client.get("/api/0/broadcasts/?show=all&query=zzz")
        assert response.status_code == 200
        assert len(response.data) == 0

    def test_basic_user_with_all(self):
        broadcast1 = Broadcast.objects.create(message="bar", is_active=True)
        Broadcast.objects.create(message="foo", is_active=False)

        self.add_user_permission(user=self.user, permission="broadcasts.admin")
        self.login_as(user=self.user, superuser=False)

        response = self.client.get("/api/0/broadcasts/?show=all")
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == six.text_type(broadcast1.id)


class BroadcastCreateTest(APITestCase):
    def test_basic_user(self):
        self.add_user_permission(user=self.user, permission="broadcasts.admin")
        self.login_as(user=self.user, superuser=False)

        response = self.client.post(
            "/api/0/broadcasts/",
            {"title": "bar", "message": "foo", "link": "http://example.com", "cta": "Read More"},
        )

        assert response.status_code == 401

    def test_superuser(self):
        self.add_user_permission(user=self.user, permission="broadcasts.admin")
        self.login_as(user=self.user, superuser=True)

        response = self.client.post(
            "/api/0/broadcasts/",
            {"title": "bar", "message": "foo", "link": "http://example.com", "cta": "Read More"},
        )

        assert response.status_code == 200, response.data

        broadcast = Broadcast.objects.get(id=response.data["id"])
        assert broadcast.title == "bar"
        assert broadcast.message == "foo"
        assert broadcast.link == "http://example.com"


class BroadcastUpdateTest(APITestCase):
    def test_simple(self):
        broadcast1 = Broadcast.objects.create(message="bar", is_active=True)
        broadcast2 = Broadcast.objects.create(message="foo", is_active=False)

        self.login_as(user=self.user)
        response = self.client.put("/api/0/broadcasts/", {"hasSeen": "1"})
        assert response.status_code == 200
        assert response.data["hasSeen"]

        assert BroadcastSeen.objects.filter(user=self.user, broadcast=broadcast1).exists()
        assert not BroadcastSeen.objects.filter(user=self.user, broadcast=broadcast2).exists()
