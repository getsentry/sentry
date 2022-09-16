from collections import namedtuple
from unittest import mock
from unittest.mock import Mock
from urllib.parse import parse_qs, urlparse

import responses
from django.test import Client, RequestFactory
from exam import fixture
from requests.exceptions import SSLError

import sentry.identity
from sentry.identity.oauth2 import OAuth2CallbackView, OAuth2LoginView
from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.identity.providers.dummy import DummyProvider
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils import json

MockResponse = namedtuple("MockResponse", ["headers", "content"])


@control_silo_test
class OAuth2CallbackViewTest(TestCase):
    def setUp(self):
        sentry.identity.register(DummyProvider)
        super().setUp()
        self.request = RequestFactory().get("/")
        self.request.subdomain = None

    def tearDown(self):
        super().tearDown()
        sentry.identity.unregister(DummyProvider)

    @fixture
    def view(self):
        return OAuth2CallbackView(
            access_token_url="https://example.org/oauth/token",
            client_id=123456,
            client_secret="secret-value",
        )

    @mock.patch("sentry.identity.oauth2.safe_urlopen")
    def test_exchange_token_success(self, safe_urlopen):
        headers = {"Content-Type": "application/json"}
        safe_urlopen.return_value = MockResponse(headers, json.dumps({"token": "a-fake-token"}))

        pipeline = IdentityProviderPipeline(request=self.request, provider_key="dummy")
        code = "auth-code"
        result = self.view.exchange_token(self.request, pipeline, code)
        assert "token" in result
        assert "a-fake-token" == result["token"]

        assert safe_urlopen.called
        data = safe_urlopen.call_args[1]["data"]
        assert data == {
            "client_id": 123456,
            "client_secret": "secret-value",
            "code": "auth-code",
            "grant_type": "authorization_code",
            "redirect_uri": "http://testserver/extensions/default/setup/",
        }

    @mock.patch("sentry.identity.oauth2.safe_urlopen")
    def test_exchange_token_success_customer_domains(self, safe_urlopen):
        headers = {"Content-Type": "application/json"}
        safe_urlopen.return_value = MockResponse(headers, json.dumps({"token": "a-fake-token"}))

        self.request.subdomain = "albertos-apples"
        pipeline = IdentityProviderPipeline(request=self.request, provider_key="dummy")
        code = "auth-code"
        result = self.view.exchange_token(self.request, pipeline, code)
        assert "token" in result
        assert "a-fake-token" == result["token"]

        assert safe_urlopen.called
        data = safe_urlopen.call_args[1]["data"]
        assert data == {
            "client_id": 123456,
            "client_secret": "secret-value",
            "code": "auth-code",
            "grant_type": "authorization_code",
            "redirect_uri": "http://albertos-apples.testserver/extensions/default/setup/",
        }

    @responses.activate
    def test_exchange_token_ssl_error(self):
        def ssl_error(request):
            raise SSLError("Could not build connection")

        responses.add_callback(
            responses.POST, "https://example.org/oauth/token", callback=ssl_error
        )
        pipeline = IdentityProviderPipeline(request=self.request, provider_key="dummy")
        code = "auth-code"
        result = self.view.exchange_token(self.request, pipeline, code)
        assert "token" not in result
        assert "error" in result
        assert "error_description" in result
        assert "SSL" in result["error_description"]

    @responses.activate
    def test_exchange_token_no_json(self):
        responses.add(responses.POST, "https://example.org/oauth/token", body="")
        pipeline = IdentityProviderPipeline(request=self.request, provider_key="dummy")
        code = "auth-code"
        result = self.view.exchange_token(self.request, pipeline, code)
        assert "token" not in result
        assert "error" in result
        assert "error_description" in result
        assert "JSON" in result["error_description"]


@control_silo_test
class OAuth2LoginViewTest(TestCase):
    def setUp(self):
        sentry.identity.register(DummyProvider)
        super().setUp()
        self.request = RequestFactory().get("/")
        self.request.session = Client().session
        self.request.subdomain = None

    def tearDown(self):
        super().tearDown()
        sentry.identity.unregister(DummyProvider)

    @fixture
    def view(self):
        return OAuth2LoginView(
            authorize_url="https://example.org/oauth2/authorize",
            client_id=123456,
            scope="all-the-things",
        )

    def test_simple(self):
        pipeline = IdentityProviderPipeline(request=self.request, provider_key="dummy")
        response = self.view.dispatch(self.request, pipeline)

        assert response.status_code == 302
        redirect_url = urlparse(response["Location"])
        query = parse_qs(redirect_url.query)

        assert query["client_id"][0] == "123456"
        assert query["redirect_uri"][0] == "http://testserver/extensions/default/setup/"
        assert query["response_type"][0] == "code"
        assert query["scope"][0] == "all-the-things"
        assert "state" in query

    def test_customer_domains(self):
        self.request.subdomain = "albertos-apples"
        pipeline = IdentityProviderPipeline(request=self.request, provider_key="dummy")
        response = self.view.dispatch(self.request, pipeline)

        assert response.status_code == 302
        redirect_url = urlparse(response["Location"])
        query = parse_qs(redirect_url.query)

        assert query["client_id"][0] == "123456"
        assert (
            query["redirect_uri"][0]
            == "http://albertos-apples.testserver/extensions/default/setup/"
        )
        assert query["response_type"][0] == "code"
        assert query["scope"][0] == "all-the-things"
        assert "state" in query
