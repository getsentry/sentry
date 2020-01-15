from __future__ import absolute_import

from sentry.utils.compat import mock
import six
from exam import fixture
from six.moves.urllib.parse import urlencode, urlparse, parse_qs
from collections import namedtuple

from django.core.urlresolvers import reverse

from sentry.auth.providers.oauth2 import OAuth2Provider, OAuth2Login, OAuth2Callback
from sentry.models import AuthProvider
from sentry.testutils import AuthProviderTestCase
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
    def get_auth_pipeline(self):
        return [DummyOAuth2Login(), DummyOAuth2Callback()]

    def build_identity(self, state):
        return state["data"]


MockResponse = namedtuple("MockResponse", ["headers", "content"])


class AuthOAuth2Test(AuthProviderTestCase):
    provider = DummyOAuth2Provider
    provider_name = "oauth2_dummy"

    def setUp(self):
        self.user = self.create_user("rick@onehundredyears.com")
        self.org = self.create_organization(owner=self.user, name="oauth2-org")
        self.auth_provider = AuthProvider.objects.create(
            provider=self.provider_name, organization=self.org
        )
        super(AuthOAuth2Test, self).setUp()

    @fixture
    def login_path(self):
        return reverse("sentry-auth-organization", args=["oauth2-org"])

    @fixture
    def sso_path(self):
        return reverse("sentry-auth-sso")

    def initiate_oauth_flow(self):
        resp = self.client.post(self.login_path, {"init": True})

        assert resp.status_code == 302
        redirect = urlparse(resp.get("Location", ""))
        query = parse_qs(redirect.query)

        assert redirect.path == "/authorize_url"
        assert query["redirect_uri"][0] == "http://testserver/auth/sso/"
        assert query["client_id"][0] == "my_client_id"
        assert "state" in query

        return query["state"][0]

    @mock.patch("sentry.auth.providers.oauth2.safe_urlopen")
    def initiate_callback(self, state, auth_data, urlopen, expect_success=True, **kargs):
        headers = {"Content-Type": "application/json"}
        urlopen.return_value = MockResponse(headers, json.dumps(auth_data))

        query = urlencode({"code": "1234", "state": state})
        resp = self.client.get(u"{}?{}".format(self.sso_path, query), **kargs)

        if expect_success:
            assert resp.status_code == 200
            assert urlopen.called
            assert urlopen.call_args[1]["data"]["code"] == "1234"
            assert urlopen.call_args[1]["data"]["client_secret"] == "my_client_secret"

        return resp

    def test_oauth2_flow(self):
        auth_data = {"id": "oauth_external_id_1234", "email": self.user.email}

        state = self.initiate_oauth_flow()
        auth_resp = self.initiate_callback(state, auth_data)

        assert auth_resp.context["existing_user"] == self.user

    def test_state_mismatch(self):
        auth_data = {"id": "oauth_external_id_1234", "email": self.user.email}

        self.initiate_oauth_flow()
        auth_resp = self.initiate_callback("bad", auth_data, expect_success=False, follow=True)

        messages = list(auth_resp.context["messages"])
        assert len(messages) == 1
        assert six.text_type(messages[0]).startswith("Authentication error")

    def test_response_errors(self):
        auth_data = {"error_description": "Mock failure"}

        state = self.initiate_oauth_flow()
        auth_resp = self.initiate_callback(state, auth_data, expect_success=False, follow=True)

        messages = list(auth_resp.context["messages"])
        assert len(messages) == 1
        assert six.text_type(messages[0]) == "Authentication error: Mock failure"

        auth_data = {"error": "its broke yo"}

        state = self.initiate_oauth_flow()
        auth_resp = self.initiate_callback(state, auth_data, expect_success=False, follow=True)

        messages = list(auth_resp.context["messages"])
        assert len(messages) == 1
        assert six.text_type(messages[0]).startswith("Authentication error")
