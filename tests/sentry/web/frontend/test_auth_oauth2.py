from collections import namedtuple
from functools import cached_property
from unittest import mock
from urllib.parse import parse_qs, urlencode, urlparse

from django.urls import reverse

from sentry.auth.authenticators.recovery_code import RecoveryCodeInterface
from sentry.auth.authenticators.totp import TotpInterface
from sentry.auth.providers.oauth2 import OAuth2Callback, OAuth2Login, OAuth2Provider
from sentry.models.authidentity import AuthIdentity
from sentry.models.authprovider import AuthProvider
from sentry.testutils.cases import AuthProviderTestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils import json


class DummyOAuth2Login(OAuth2Login):
    authorize_url = "http://example.com/authorize_url"
    client_id = "my_client_id"
    scope = "test_scope"


class DummyOAuth2Callback(OAuth2Callback):
    access_token_url = "http://example.com/token_url"
    client_id = "my_client_id"
    client_secret = "my_client_secret"


class DummyOAuth2Provider(OAuth2Provider):
    name = "dummy"

    def get_client_id(self):
        raise NotImplementedError

    def get_client_secret(self):
        raise NotImplementedError

    def get_refresh_token_url(self) -> str:
        raise NotImplementedError

    def build_config(self, state):
        pass

    def get_auth_pipeline(self):
        return [DummyOAuth2Login(), DummyOAuth2Callback()]

    def build_identity(self, state):
        return state["data"]


MockResponse = namedtuple("MockResponse", ["headers", "content"])


@control_silo_test
class AuthOAuth2Test(AuthProviderTestCase):
    provider = DummyOAuth2Provider
    provider_name = "oauth2_dummy"

    def setUp(self):
        super().setUp()
        auth_provider = AuthProvider.objects.create(
            provider=self.provider_name, organization_id=self.organization.id
        )
        AuthIdentity.objects.create(
            auth_provider=auth_provider,
            user=self.user,
            ident="oauth_external_id_1234",
        )

    @cached_property
    def login_path(self):
        return reverse("sentry-auth-organization", args=[self.organization.slug])

    @cached_property
    def sso_path(self):
        return reverse("sentry-auth-sso")

    def initiate_oauth_flow(self, http_host=None):
        kwargs = {}
        if http_host is not None:
            kwargs["HTTP_HOST"] = http_host
        else:
            http_host = "testserver"

        resp = self.client.post(self.login_path, {"init": True}, **kwargs)

        assert resp.status_code == 302
        redirect_dest = resp.get("Location", "")
        assert redirect_dest.startswith("http://example.com/authorize_url")
        redirect = urlparse(redirect_dest)
        query = parse_qs(redirect.query)

        assert redirect.path == "/authorize_url"
        assert query["redirect_uri"][0] == "http://testserver/auth/sso/"
        assert query["client_id"][0] == "my_client_id"
        assert "state" in query

        return query["state"][0]

    @mock.patch("sentry.auth.providers.oauth2.safe_urlopen")
    def initiate_callback(
        self,
        state,
        auth_data,
        urlopen,
        expect_success=True,
        customer_domain="",
        has_2fa=False,
        **kwargs,
    ):
        headers = {"Content-Type": "application/json"}
        urlopen.return_value = MockResponse(headers, json.dumps(auth_data))

        query = urlencode({"code": "1234", "state": state})
        resp = self.client.get(f"{self.sso_path}?{query}", **kwargs)

        if expect_success:

            if has_2fa:
                assert resp["Location"] == "/auth/2fa/"
                with mock.patch(
                    "sentry.auth.authenticators.TotpInterface.validate_otp", return_value=True
                ):
                    assert resp.status_code == 302
                    resp = self.client.post(reverse("sentry-2fa-dialog"), {"otp": "something"})
                    assert resp.status_code == 302
                    assert resp["Location"].startswith("http://testserver/auth/sso/?")
                    resp = self.client.get(resp["Location"])

            assert resp.status_code == 302
            assert resp["Location"] == f"{customer_domain}/auth/login/"
            resp = self.client.get(resp["Location"], follow=True)
            assert resp.status_code == 200
            assert resp.redirect_chain == [("/organizations/baz/issues/", 302)]
            assert resp.context["user"].id == self.user.id

            assert urlopen.called
            data = urlopen.call_args[1]["data"]

            assert data == {
                "grant_type": "authorization_code",
                "code": "1234",
                "redirect_uri": "http://testserver/auth/sso/",
                "client_id": "my_client_id",
                "client_secret": "my_client_secret",
            }
        return resp

    def test_oauth2_flow(self):
        auth_data = {"id": "oauth_external_id_1234", "email": self.user.email}

        state = self.initiate_oauth_flow()
        self.initiate_callback(state, auth_data)

    def test_oauth2_flow_customer_domain(self):
        HTTP_HOST = "albertos-apples.testserver"
        auth_data = {"id": "oauth_external_id_1234", "email": self.user.email}

        state = self.initiate_oauth_flow(http_host=HTTP_HOST)
        self.initiate_callback(
            state,
            auth_data,
            customer_domain="http://albertos-apples.testserver",
        )

    @mock.patch("sentry.utils.auth.login")
    def test_oauth2_flow_incomplete_security_checks(self, mock_login):
        mock_login.return_value = False
        auth_data = {"id": "oauth_external_id_1234", "email": self.user.email}

        state = self.initiate_oauth_flow()
        response = self.initiate_callback(state, auth_data, expect_success=False, follow=True)
        assert response.status_code == 200
        assert response.redirect_chain == [("/auth/login/", 302)]
        assert response.context["user"] != self.user

    @mock.patch("sentry.utils.auth.login")
    def test_oauth2_flow_customer_domain_incomplete_security_checks(self, mock_login):
        HTTP_HOST = "albertos-apples.testserver"
        mock_login.return_value = False
        auth_data = {"id": "oauth_external_id_1234", "email": self.user.email}

        state = self.initiate_oauth_flow(http_host=HTTP_HOST)
        response = self.initiate_callback(state, auth_data, expect_success=False, follow=True)
        assert response.status_code == 200
        assert response.redirect_chain == [("http://albertos-apples.testserver/auth/login/", 302)]
        assert response.context["user"] != self.user

    def test_oauth2_flow_with_2fa(self):
        RecoveryCodeInterface().enroll(self.user)
        TotpInterface().enroll(self.user)

        auth_data = {"id": "oauth_external_id_1234", "email": self.user.email}

        state = self.initiate_oauth_flow()
        self.initiate_callback(state, auth_data, has_2fa=True)

    def test_state_mismatch(self):
        auth_data = {"id": "oauth_external_id_1234", "email": self.user.email}

        self.initiate_oauth_flow()
        auth_resp = self.initiate_callback("bad", auth_data, expect_success=False, follow=True)

        messages = list(auth_resp.context["messages"])
        assert len(messages) == 1
        assert str(messages[0]).startswith("Authentication error")
        assert auth_resp.context["user"] != self.user

    def test_response_errors(self):
        auth_data = {"error_description": "Mock failure"}

        state = self.initiate_oauth_flow()
        auth_resp = self.initiate_callback(state, auth_data, expect_success=False, follow=True)

        messages = list(auth_resp.context["messages"])
        assert len(messages) == 1
        assert str(messages[0]) == "Authentication error: Mock failure"

        auth_data = {"error": "its broke yo"}

        state = self.initiate_oauth_flow()
        auth_resp = self.initiate_callback(state, auth_data, expect_success=False, follow=True)

        messages = list(auth_resp.context["messages"])
        assert len(messages) == 1
        assert str(messages[0]).startswith("Authentication error")
        assert auth_resp.context["user"] != self.user
