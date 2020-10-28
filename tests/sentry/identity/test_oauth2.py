from __future__ import absolute_import

import responses
from exam import fixture
from sentry.utils.compat.mock import Mock
from requests.exceptions import SSLError

import sentry.identity
from sentry.identity.oauth2 import OAuth2CallbackView
from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.identity.providers.dummy import DummyProvider
from sentry.testutils import TestCase


class OAuth2CallbackViewTest(TestCase):
    def setUp(self):
        self.org = self.create_organization(owner=self.user)
        self.user = self.create_user("foo@example.com")
        sentry.identity.register(DummyProvider)
        super(OAuth2CallbackViewTest, self).setUp()

    def tearDown(self):
        super(OAuth2CallbackViewTest, self).tearDown()
        sentry.identity.unregister(DummyProvider)

    @fixture
    def view(self):
        return OAuth2CallbackView(
            access_token_url="https://example.org/oauth/token",
            client_id=123456,
            client_secret="secret-value",
        )

    @responses.activate
    def test_exchange_token_success(self):
        responses.add(
            responses.POST, "https://example.org/oauth/token", json={"token": "a-fake-token"}
        )
        pipeline = IdentityProviderPipeline(request=Mock(), provider_key="dummy")
        code = "auth-code"
        result = self.view.exchange_token(None, pipeline, code)
        assert "token" in result
        assert "a-fake-token" == result["token"]

    @responses.activate
    def test_exchange_token_ssl_error(self):
        def ssl_error(request):
            raise SSLError("Could not build connection")

        responses.add_callback(
            responses.POST, "https://example.org/oauth/token", callback=ssl_error
        )
        pipeline = IdentityProviderPipeline(request=Mock(), provider_key="dummy")
        code = "auth-code"
        result = self.view.exchange_token(None, pipeline, code)
        assert "token" not in result
        assert "error" in result
        assert "error_description" in result
        assert "SSL" in result["error_description"]

    @responses.activate
    def test_exchange_token_no_json(self):
        responses.add(responses.POST, "https://example.org/oauth/token", body="")
        pipeline = IdentityProviderPipeline(request=Mock(), provider_key="dummy")
        code = "auth-code"
        result = self.view.exchange_token(None, pipeline, code)
        assert "token" not in result
        assert "error" in result
        assert "error_description" in result
        assert "JSON" in result["error_description"]
