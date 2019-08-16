from __future__ import absolute_import

import six

from base64 import b64encode
from sentry.testutils import APITestCase


class AuthDetailsEndpointTest(APITestCase):
    path = "/api/0/auth/"

    def test_logged_in(self):
        user = self.create_user("foo@example.com")
        self.login_as(user)
        response = self.client.get(self.path)
        assert response.status_code == 200
        assert response.data["id"] == six.text_type(user.id)

    def test_logged_out(self):
        response = self.client.get(self.path)
        assert response.status_code == 400


class AuthLoginEndpointTest(APITestCase):
    path = "/api/0/auth/"

    def test_valid_password(self):
        user = self.create_user("foo@example.com")
        response = self.client.post(
            self.path,
            HTTP_AUTHORIZATION=u"Basic {}".format(
                b64encode(u"{}:{}".format(user.username, "admin"))
            ),
        )
        assert response.status_code == 200
        assert response.data["id"] == six.text_type(user.id)

    def test_invalid_password(self):
        user = self.create_user("foo@example.com")
        response = self.client.post(
            self.path,
            HTTP_AUTHORIZATION=u"Basic {}".format(
                b64encode(u"{}:{}".format(user.username, "foobar"))
            ),
        )
        assert response.status_code == 401


class AuthVerifyEndpointTest(APITestCase):
    path = "/api/0/auth/"

    def test_valid_password(self):
        user = self.create_user("foo@example.com")
        self.login_as(user)
        response = self.client.put(self.path, data={"password": "admin"})
        assert response.status_code == 200
        assert response.data["id"] == six.text_type(user.id)

    def test_invalid_password(self):
        user = self.create_user("foo@example.com")
        self.login_as(user)
        response = self.client.put(self.path, data={"password": "foobar"})
        assert response.status_code == 403

    def test_no_password_no_u2f(self):
        user = self.create_user("foo@example.com")
        self.login_as(user)
        response = self.client.put(self.path, data={})
        assert response.status_code == 400


class AuthLogoutEndpointTest(APITestCase):
    path = "/api/0/auth/"

    def test_logged_in(self):
        user = self.create_user("foo@example.com")
        self.login_as(user)
        response = self.client.delete(self.path)
        assert response.status_code == 204
        assert list(self.client.session.keys()) == []

    def test_logged_in__invalidate_all_sessions(self):
        user = self.create_user("foo@example.com")
        self.login_as(user)
        response = self.client.delete(self.path, data={"all": 1})
        assert response.status_code == 204
        assert list(self.client.session.keys()) == []
        updated = type(user).objects.get(pk=user.id)
        assert updated.session_nonce != user.session_nonce

    def test_logged_out(self):
        response = self.client.delete(self.path)
        assert response.status_code == 204
        assert list(self.client.session.keys()) == []
