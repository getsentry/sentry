from collections import namedtuple
from functools import cached_property
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, parse_qsl, urlparse

import responses
from django.http import HttpResponse
from django.test import Client, RequestFactory
from requests.exceptions import SSLError

import sentry.identity
from sentry.identity import oauth2 as oauth2_module
from sentry.identity.oauth2 import OAuth2CallbackView, OAuth2LoginView
from sentry.identity.pipeline import IdentityPipeline
from sentry.identity.providers.dummy import DummyProvider
from sentry.integrations.types import EventLifecycleOutcome
from sentry.shared_integrations.exceptions import ApiUnauthorized
from sentry.testutils.asserts import assert_failure_metric, assert_slo_metric
from sentry.testutils.silo import control_silo_test

MockResponse = namedtuple("MockResponse", ["headers", "content"])


class StubPipeline:
    def __init__(self, state: str | None = None):
        self.provider = SimpleNamespace(key="dummy")
        self.config: dict[str, object] = {}
        self._state: dict[str, str] = {}
        if state is not None:
            self._state["state"] = state
        self.error = MagicMock(return_value=HttpResponse("error"))
        self.next_step = MagicMock(return_value=HttpResponse("next"))

    def bind_state(self, key: str, value: str) -> None:
        self._state[key] = value

    def fetch_state(self, key: str):
        return self._state.get(key)


@control_silo_test
@patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
class OAuth2CallbackViewTest(TestCase):
    def setUp(self) -> None:
        sentry.identity.register(DummyProvider)
        super().setUp()
        self.request = RequestFactory().get("/")
        self.request.subdomain = None

    def tearDown(self) -> None:
        super().tearDown()
        sentry.identity.unregister(DummyProvider)

    @cached_property
    def view(self):
        return OAuth2CallbackView(
            access_token_url="https://example.org/oauth/token",
            client_id=123456,
            client_secret="secret-value",
        )

    @responses.activate
    def test_exchange_token_success(self, mock_record: MagicMock) -> None:
        responses.add(
            responses.POST, "https://example.org/oauth/token", json={"token": "a-fake-token"}
        )

        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        code = "auth-code"
        result = self.view.exchange_token(self.request, pipeline, code)
        assert "token" in result
        assert "a-fake-token" == result["token"]

        assert len(responses.calls) == 1
        assert responses.calls[0].request.url == "https://example.org/oauth/token"
        data = dict(parse_qsl(responses.calls[0].request.body))
        assert data == {
            "client_id": "123456",
            "client_secret": "secret-value",
            "code": "auth-code",
            "grant_type": "authorization_code",
            "redirect_uri": "http://testserver/extensions/default/setup/",
        }

        assert_slo_metric(mock_record, EventLifecycleOutcome.SUCCESS)

    @responses.activate
    def test_exchange_token_success_customer_domains(self, mock_record: MagicMock) -> None:
        responses.add(
            responses.POST, "https://example.org/oauth/token", json={"token": "a-fake-token"}
        )
        self.request.subdomain = "albertos-apples"
        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        code = "auth-code"
        result = self.view.exchange_token(self.request, pipeline, code)
        assert "token" in result
        assert "a-fake-token" == result["token"]

        assert len(responses.calls) == 1
        assert responses.calls[0].request.url == "https://example.org/oauth/token"
        data = dict(parse_qsl(responses.calls[0].request.body))
        assert data == {
            "client_id": "123456",
            "client_secret": "secret-value",
            "code": "auth-code",
            "grant_type": "authorization_code",
            "redirect_uri": "http://testserver/extensions/default/setup/",
        }

        assert_slo_metric(mock_record, EventLifecycleOutcome.SUCCESS)

    @responses.activate
    def test_exchange_token_ssl_error(self, mock_record: MagicMock) -> None:
        def ssl_error(request):
            raise SSLError("Could not build connection")

        responses.add_callback(
            responses.POST, "https://example.org/oauth/token", callback=ssl_error
        )
        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        code = "auth-code"
        result = self.view.exchange_token(self.request, pipeline, code)
        assert "token" not in result
        assert "error" in result
        assert "error_description" in result
        assert "SSL" in result["error_description"]

        assert_failure_metric(mock_record, "ssl_error")

    @responses.activate
    def test_connection_error(self, mock_record: MagicMock) -> None:
        def connection_error(request):
            raise ConnectionError("Name or service not known")

        responses.add_callback(
            responses.POST, "https://example.org/oauth/token", callback=connection_error
        )
        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        code = "auth-code"
        result = self.view.exchange_token(self.request, pipeline, code)
        assert "token" not in result
        assert "error" in result
        assert "connect" in result["error"]
        assert "error_description" in result

        assert_failure_metric(mock_record, "connection_error")

    @responses.activate
    def test_exchange_token_no_json(self, mock_record: MagicMock) -> None:
        responses.add(responses.POST, "https://example.org/oauth/token", body="")
        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        code = "auth-code"
        result = self.view.exchange_token(self.request, pipeline, code)
        assert "token" not in result
        assert "error" in result
        assert "error_description" in result
        assert "JSON" in result["error_description"]

        assert_failure_metric(mock_record, "json_error")

    @responses.activate
    def test_api_error(self, mock_record: MagicMock) -> None:
        responses.add(
            responses.POST,
            "https://example.org/oauth/token",
            json={"token": "a-fake-token"},
            status=401,
        )
        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        code = "auth-code"
        result = self.view.exchange_token(self.request, pipeline, code)
        assert "token" not in result
        assert "error" in result
        assert "401" in result["error"]

        assert_failure_metric(mock_record, ApiUnauthorized('{"token": "a-fake-token"}'))

    def test_dispatch_requires_state_before_error(self, mock_record: MagicMock) -> None:
        pipeline = StubPipeline(state="expected-state")
        request = RequestFactory().get("/?error=boom")
        request.subdomain = None

        response = self.view.dispatch(request, pipeline)

        assert response == pipeline.error.return_value
        pipeline.error.assert_called_once_with(oauth2_module.ERR_INVALID_STATE)
        pipeline.next_step.assert_not_called()

    def test_dispatch_rejects_mismatched_state(self, mock_record: MagicMock) -> None:
        pipeline = StubPipeline(state="expected-state")
        request = RequestFactory().get("/?error=boom&state=wrong")
        request.subdomain = None

        response = self.view.dispatch(request, pipeline)

        assert response == pipeline.error.return_value
        pipeline.error.assert_called_once_with(oauth2_module.ERR_INVALID_STATE)
        pipeline.next_step.assert_not_called()

    def test_dispatch_passes_through_error_with_valid_state(self, mock_record: MagicMock) -> None:
        pipeline = StubPipeline(state="expected-state")
        request = RequestFactory().get("/?error=boom&state=expected-state")
        request.subdomain = None

        response = self.view.dispatch(request, pipeline)

        assert response == pipeline.error.return_value
        pipeline.error.assert_called_once()
        error_message = pipeline.error.call_args[0][0]
        assert "boom" in error_message
        assert error_message.startswith(oauth2_module.ERR_INVALID_STATE)
        pipeline.next_step.assert_not_called()

@control_silo_test
class OAuth2LoginViewTest(TestCase):
    def setUp(self) -> None:
        sentry.identity.register(DummyProvider)
        super().setUp()
        self.request = RequestFactory().get("/")
        self.request.session = Client().session
        self.request.subdomain = None

    def tearDown(self) -> None:
        super().tearDown()
        sentry.identity.unregister(DummyProvider)

    @cached_property
    def view(self):
        return OAuth2LoginView(
            authorize_url="https://example.org/oauth2/authorize",
            client_id=123456,
            scope="all-the-things",
        )

    def test_simple(self) -> None:
        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        response = self.view.dispatch(self.request, pipeline)

        assert response.status_code == 302
        assert response["Location"].startswith("https://example.org/oauth2/authorize")
        redirect_url = urlparse(response["Location"])
        query = parse_qs(redirect_url.query)

        assert query["client_id"][0] == "123456"
        assert query["redirect_uri"][0] == "http://testserver/extensions/default/setup/"
        assert query["response_type"][0] == "code"
        assert query["scope"][0] == "all-the-things"
        assert "state" in query

    def test_customer_domains(self) -> None:
        self.request.subdomain = "albertos-apples"
        pipeline = IdentityPipeline(request=self.request, provider_key="dummy")
        response = self.view.dispatch(self.request, pipeline)

        assert response.status_code == 302
        assert response["Location"].startswith("https://example.org/oauth2/authorize")
        redirect_url = urlparse(response["Location"])
        query = parse_qs(redirect_url.query)

        assert query["client_id"][0] == "123456"
        assert query["redirect_uri"][0] == "http://testserver/extensions/default/setup/"
        assert query["response_type"][0] == "code"
        assert query["scope"][0] == "all-the-things"
        assert "state" in query

    def test_error_callback_without_state_is_rejected(self) -> None:
        pipeline = StubPipeline()
        request = RequestFactory().get("/?error=bad")
        request.session = Client().session
        request.subdomain = None

        response = self.view.dispatch(request, pipeline)

        assert response == pipeline.error.return_value
        pipeline.error.assert_called_once_with(oauth2_module.ERR_INVALID_STATE)
        pipeline.next_step.assert_not_called()

    def test_error_callback_with_valid_state_advances(self) -> None:
        pipeline = StubPipeline(state="expected-state")
        request = RequestFactory().get("/?error=bad&state=expected-state")
        request.session = Client().session
        request.subdomain = None

        response = self.view.dispatch(request, pipeline)

        assert response == pipeline.next_step.return_value
        pipeline.next_step.assert_called_once()
        pipeline.error.assert_not_called()

    def test_error_callback_with_state_mismatch_is_rejected(self) -> None:
        pipeline = StubPipeline(state="expected-state")
        request = RequestFactory().get("/?error=bad&state=wrong")
        request.session = Client().session
        request.subdomain = None

        response = self.view.dispatch(request, pipeline)

        assert response == pipeline.error.return_value
        pipeline.error.assert_called_once_with(oauth2_module.ERR_INVALID_STATE)
        pipeline.next_step.assert_not_called()
