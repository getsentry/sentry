from base64 import b64encode
from unittest import mock

from django.test import override_settings

from sentry.models import AuthProvider
from sentry.testutils import APITestCase
from sentry.testutils.cases import AuthProviderTestCase


class AuthDetailsEndpointTest(APITestCase):
    path = "/api/0/auth/"

    def test_logged_in(self):
        user = self.create_user("foo@example.com")
        self.login_as(user)
        response = self.client.get(self.path)
        assert response.status_code == 200
        assert response.data["id"] == str(user.id)

    def test_logged_out(self):
        response = self.client.get(self.path)
        assert response.status_code == 400


class AuthLoginEndpointTest(APITestCase):
    path = "/api/0/auth/"

    def test_valid_password(self):
        user = self.create_user("foo@example.com")
        response = self.client.post(
            self.path,
            HTTP_AUTHORIZATION=b"Basic " + b64encode(f"{user.username}:admin".encode()),
        )
        assert response.status_code == 200
        assert response.data["id"] == str(user.id)

    def test_invalid_password(self):
        user = self.create_user("foo@example.com")
        response = self.client.post(
            self.path,
            HTTP_AUTHORIZATION=b"Basic " + b64encode(f"{user.username}:foobar".encode()),
        )
        assert response.status_code == 401


class AuthVerifyEndpointTest(APITestCase):
    path = "/api/0/auth/"

    def test_valid_password(self):
        user = self.create_user("foo@example.com")
        self.login_as(user)
        response = self.client.put(self.path, data={"password": "admin"})
        assert response.status_code == 200
        assert response.data["id"] == str(user.id)

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


class AuthVerifyEndpointSuperuserTest(AuthProviderTestCase, APITestCase):
    path = "/api/0/auth/"

    def test_superuser_no_sso(self):
        from sentry.auth.superuser import Superuser

        AuthProvider.objects.create(organization=self.organization, provider="dummy")

        user = self.create_user("foo@example.com", is_superuser=True)

        with mock.patch.object(Superuser, "org_id", self.organization.id), override_settings(
            SUPERUSER_ORG_ID=self.organization.id
        ):
            self.login_as(user)
            response = self.client.put(self.path, data={"password": "admin"})
            assert response.status_code == 401

    def test_superuser_no_sso_with_referrer(self):
        from sentry.auth.superuser import Superuser

        AuthProvider.objects.create(organization=self.organization, provider="dummy")

        user = self.create_user("foo@example.com", is_superuser=True)

        with mock.patch.object(Superuser, "org_id", self.organization.id), override_settings(
            SUPERUSER_ORG_ID=self.organization.id
        ):
            self.login_as(user)
            response = self.client.put(
                self.path, HTTP_REFERER="http://testserver/bar", data={"password": "admin"}
            )
            assert response.status_code == 401
            assert self.client.session["_next"] == "http://testserver/bar"

    def test_superuser_no_sso_with_bad_referrer(self):
        from sentry.auth.superuser import Superuser

        AuthProvider.objects.create(organization=self.organization, provider="dummy")

        user = self.create_user("foo@example.com", is_superuser=True)

        with mock.patch.object(Superuser, "org_id", self.organization.id), override_settings(
            SUPERUSER_ORG_ID=self.organization.id
        ):
            self.login_as(user)
            response = self.client.put(
                self.path, HTTP_REFERER="http://hacktheplanet/bar", data={"password": "admin"}
            )
            assert response.status_code == 401
            assert self.client.session.get("_next") is None


class AuthLogoutEndpointTest(APITestCase):
    path = "/api/0/auth/"

    def test_logged_in(self):
        user = self.create_user("foo@example.com")
        self.login_as(user)
        response = self.client.delete(self.path)
        assert response.status_code == 204
        assert list(self.client.session.keys()) == []

    def test_logged_out(self):
        user = self.create_user("foo@example.com")
        self.login_as(user)
        response = self.client.delete(self.path)
        assert response.status_code == 204
        assert list(self.client.session.keys()) == []
        updated = type(user).objects.get(pk=user.id)
        assert updated.session_nonce != user.session_nonce
