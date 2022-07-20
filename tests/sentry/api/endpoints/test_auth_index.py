from base64 import b64encode
from unittest import mock

from django.test import override_settings

from sentry.models import Authenticator, AuthProvider
from sentry.models.authidentity import AuthIdentity
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

    def get_auth(self, user):
        return Authenticator.objects.create(
            type=3,  # u2f
            user=user,
            config={
                "devices": [
                    {
                        "binding": {
                            "publicKey": "aowekroawker",
                            "keyHandle": "devicekeyhandle",
                            "appId": "https://testserver/auth/2fa/u2fappid.json",
                        },
                        "name": "Amused Beetle",
                        "ts": 1512505334,
                    },
                    {
                        "binding": {
                            "publicKey": "publickey",
                            "keyHandle": "aowerkoweraowerkkro",
                            "appId": "https://testserver/auth/2fa/u2fappid.json",
                        },
                        "name": "Sentry",
                        "ts": 1512505334,
                    },
                ]
            },
        )

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

    @mock.patch("sentry.auth.authenticators.U2fInterface.is_available", return_value=True)
    @mock.patch("sentry.auth.authenticators.U2fInterface.validate_response", return_value=True)
    def test_valid_password_u2f(self, validate_response, is_available):
        user = self.create_user("foo@example.com")
        self.org = self.create_organization(owner=user, name="foo")
        self.login_as(user)
        self.get_auth(user)
        response = self.client.put(
            self.path,
            user=user,
            data={
                "password": "admin",
                "challenge": """{"challenge":"challenge"}""",
                "response": """{"response":"response"}""",
            },
        )
        assert response.status_code == 200
        assert validate_response.call_count == 1
        assert {"challenge": "challenge"} in validate_response.call_args[0]
        assert {"response": "response"} in validate_response.call_args[0]


class AuthVerifyEndpointSuperuserTest(AuthProviderTestCase, APITestCase):
    path = "/api/0/auth/"

    def test_superuser_sso_user_no_password_saas_product(self):
        from sentry.auth.superuser import COOKIE_NAME, Superuser

        with self.settings(SENTRY_SELF_HOSTED=False):
            org_provider = AuthProvider.objects.create(
                organization=self.organization, provider="dummy"
            )

            user = self.create_user("foo@example.com", is_superuser=True)

            user.update(password="")

            AuthIdentity.objects.create(user=user, auth_provider=org_provider)

            with mock.patch.object(Superuser, "org_id", self.organization.id), override_settings(
                SUPERUSER_ORG_ID=self.organization.id
            ):
                with self.settings(SENTRY_SELF_HOSTED=False):
                    self.login_as(user, organization_id=self.organization.id)
                    response = self.client.put(
                        self.path,
                        data={
                            "isSuperuserModal": True,
                            "superuserAccessCategory": "for_unit_test",
                            "superuserReason": "for testing",
                        },
                    )
                    assert response.status_code == 200
                    assert COOKIE_NAME in response.cookies

    def test_superuser_sso_user_has_password_saas_product(self):
        from sentry.auth.superuser import COOKIE_NAME, Superuser

        with self.settings(
            SENTRY_SELF_HOSTED=False, VALIDATE_SUPERUSER_ACCESS_CATEGORY_AND_REASON=True
        ):
            org_provider = AuthProvider.objects.create(
                organization=self.organization, provider="dummy"
            )

            user = self.create_user("foo@example.com", is_superuser=True)

            AuthIdentity.objects.create(user=user, auth_provider=org_provider)

            with mock.patch.object(Superuser, "org_id", self.organization.id), override_settings(
                SUPERUSER_ORG_ID=self.organization.id
            ):
                with self.settings(SENTRY_SELF_HOSTED=False):
                    self.login_as(user, organization_id=self.organization.id)
                    response = self.client.put(
                        self.path,
                        data={
                            "isSuperuserModal": True,
                            "superuserAccessCategory": "for_unit_test",
                            "superuserReason": "for testing",
                        },
                    )
                    assert response.status_code == 200
                    assert COOKIE_NAME in response.cookies

    def test_superuser_no_sso_user_has_password_saas_product(self):
        from sentry.auth.superuser import Superuser

        with self.settings(
            SENTRY_SELF_HOSTED=False, VALIDATE_SUPERUSER_ACCESS_CATEGORY_AND_REASON=True
        ):
            AuthProvider.objects.create(organization=self.organization, provider="dummy")

            user = self.create_user("foo@example.com", is_superuser=True)

            with mock.patch.object(Superuser, "org_id", self.organization.id), override_settings(
                SUPERUSER_ORG_ID=self.organization.id
            ):
                self.login_as(user)
                response = self.client.put(
                    self.path,
                    data={
                        "password": "admin",
                        "isSuperuserModal": True,
                        "superuserAccessCategory": "for_unit_test",
                        "superuserReason": "for testing",
                    },
                )
                assert response.status_code == 401

    def test_superuser_no_sso_user_has_password_self_hosted(self):
        from sentry.auth.superuser import Superuser

        AuthProvider.objects.create(organization=self.organization, provider="dummy")

        user = self.create_user("foo@example.com", is_superuser=True)

        with mock.patch.object(Superuser, "org_id", None), override_settings(SUPERUSER_ORG_ID=None):
            with self.settings(SENTRY_SELF_HOSTED=True):
                self.login_as(user)
                response = self.client.put(
                    self.path,
                    data={
                        "password": "admin",
                        "isSuperuserModal": True,
                    },
                )
                assert response.status_code == 200

    def test_superuser_no_sso_self_hosted_no_password_or_u2f(self):
        from sentry.auth.superuser import Superuser

        AuthProvider.objects.create(organization=self.organization, provider="dummy")

        user = self.create_user("foo@example.com", is_superuser=True)

        with mock.patch.object(Superuser, "org_id", None), override_settings(SUPERUSER_ORG_ID=None):
            with self.settings(SENTRY_SELF_HOSTED=True):
                self.login_as(user)
                response = self.client.put(
                    self.path,
                    data={
                        "isSuperuserModal": True,
                    },
                )
                assert response.status_code == 403

    def test_superuser_no_sso_user_has_password_su_form_off_saas(self):
        from sentry.auth.superuser import Superuser

        with self.settings(SENTRY_SELF_HOSTED=False):
            AuthProvider.objects.create(organization=self.organization, provider="dummy")

            user = self.create_user("foo@example.com", is_superuser=True)

            with mock.patch.object(Superuser, "org_id", None), override_settings(
                SUPERUSER_ORG_ID=None
            ):
                with self.settings(SENTRY_SELF_HOSTED=True):
                    self.login_as(user)
                    response = self.client.put(
                        self.path,
                        data={
                            "password": "admin",
                            "isSuperuserModal": True,
                        },
                    )
                    assert response.status_code == 200

    def test_superuser_no_sso_su_form_off_no_password_or_u2f_saas(self):
        from sentry.auth.superuser import Superuser

        with self.settings(SENTRY_SELF_HOSTED=False):
            AuthProvider.objects.create(organization=self.organization, provider="dummy")

            user = self.create_user("foo@example.com", is_superuser=True)

            with mock.patch.object(Superuser, "org_id", None), override_settings(
                SUPERUSER_ORG_ID=None
            ):
                self.login_as(user)
                response = self.client.put(
                    self.path,
                    data={
                        "isSuperuserModal": True,
                    },
                )
                assert response.status_code == 403

    def test_superuser_no_sso_user_has_password_su_form_on_self_hosted(self):
        from sentry.auth.superuser import Superuser

        with self.settings(
            SENTRY_SELF_HOSTED=True, VALIDATE_SUPERUSER_ACCESS_CATEGORY_AND_REASON=True
        ):
            AuthProvider.objects.create(organization=self.organization, provider="dummy")

            user = self.create_user("foo@example.com", is_superuser=True)

            with mock.patch.object(Superuser, "org_id", None), override_settings(
                SUPERUSER_ORG_ID=None
            ):
                with self.settings(SENTRY_SELF_HOSTED=True):
                    self.login_as(user)
                    response = self.client.put(
                        self.path,
                        data={
                            "password": "admin",
                            "isSuperuserModal": True,
                        },
                    )
                    assert response.status_code == 200

    def test_superuser_no_sso_su_form_on_no_password_or_u2f_self_hosted(self):
        from sentry.auth.superuser import Superuser

        with self.settings(
            SENTRY_SELF_HOSTED=True, VALIDATE_SUPERUSER_ACCESS_CATEGORY_AND_REASON=True
        ):
            AuthProvider.objects.create(organization=self.organization, provider="dummy")

            user = self.create_user("foo@example.com", is_superuser=True)

            with mock.patch.object(Superuser, "org_id", None), override_settings(
                SUPERUSER_ORG_ID=None
            ):
                self.login_as(user)
                response = self.client.put(
                    self.path,
                    data={
                        "isSuperuserModal": True,
                    },
                )
                assert response.status_code == 403

    def test_superuser_no_sso_with_referrer(self):
        from sentry.auth.superuser import Superuser

        user = self.create_user("foo@example.com", is_superuser=True)

        with mock.patch.object(Superuser, "org_id", self.organization.id), override_settings(
            SUPERUSER_ORG_ID=self.organization.id
        ):
            self.login_as(user)
            response = self.client.put(
                self.path,
                HTTP_REFERER="http://testserver/bar",
                data={
                    "password": "admin",
                    "isSuperuserModal": True,
                    "superuserAccessCategory": "for_unit_test",
                    "superuserReason": "for testing",
                },
            )
            assert response.status_code == 401
            assert self.client.session["_next"] == "http://testserver/bar"

    def test_superuser_no_sso_with_bad_referrer(self):
        from sentry.auth.superuser import Superuser

        user = self.create_user("foo@example.com", is_superuser=True)

        with mock.patch.object(Superuser, "org_id", self.organization.id), override_settings(
            SUPERUSER_ORG_ID=self.organization.id
        ):
            self.login_as(user)
            response = self.client.put(
                self.path,
                HTTP_REFERER="http://hacktheplanet/bar",
                data={
                    "password": "admin",
                    "isSuperuserModal": True,
                    "superuserAccessCategory": "for_unit_test",
                    "superuserReason": "for testing",
                },
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
