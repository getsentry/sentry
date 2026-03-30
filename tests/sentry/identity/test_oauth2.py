from __future__ import annotations

from collections import namedtuple
from functools import cached_property
from typing import Any, cast
from unittest import TestCase
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, parse_qsl, urlparse

import responses
from django.test import Client, RequestFactory
from requests.exceptions import ConnectionError, SSLError

import sentry.identity
from sentry.identity.oauth2 import OAuth2ApiStep, OAuth2CallbackView, OAuth2LoginView
from sentry.identity.pipeline import IdentityPipeline
from sentry.identity.providers.dummy import DummyProvider
from sentry.integrations.types import EventLifecycleOutcome
from sentry.pipeline.base import Pipeline
from sentry.pipeline.types import PipelineStepAction
from sentry.shared_integrations.exceptions import ApiUnauthorized
from sentry.testutils.asserts import assert_failure_metric, assert_slo_metric
from sentry.testutils.silo import control_silo_test

MockResponse = namedtuple("MockResponse", ["headers", "content"])


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


class _FakePipelineContext:
    """Minimal pipeline-like object for testing OAuth2ApiStep."""

    def __init__(self, signature: str = "test-signature") -> None:
        self.signature = signature
        self._state: dict[str, Any] = {}

    def bind_state(self, key: str, value: Any) -> None:
        self._state[key] = value

    def fetch_state(self, key: str | None = None) -> Any:
        if key is None:
            return self._state
        return self._state.get(key)


@control_silo_test
class OAuth2ApiStepGetStepDataTest(TestCase):
    @cached_property
    def step(self) -> OAuth2ApiStep:
        return OAuth2ApiStep(
            authorize_url="https://example.org/oauth2/authorize",
            client_id="123456",
            client_secret="secret-value",
            access_token_url="https://example.org/oauth/token",
            scope="all-the-things",
            redirect_url="/extensions/default/setup/",
        )

    def test_returns_oauth_url(self) -> None:
        ctx = cast(Pipeline, _FakePipelineContext(signature="abc123"))
        request = RequestFactory().get("/")
        data = self.step.get_step_data(ctx, request)

        assert "oauthUrl" in data
        url = urlparse(data["oauthUrl"])
        assert url.scheme == "https"
        assert url.hostname == "example.org"
        assert url.path == "/oauth2/authorize"

        query = parse_qs(url.query)
        assert query["client_id"] == ["123456"]
        assert query["response_type"] == ["code"]
        assert query["scope"] == ["all-the-things"]
        assert query["state"] == ["abc123"]
        assert "redirect_uri" in query

    def test_serializer_requires_code_and_state(self) -> None:
        ser_cls = self.step.get_serializer_cls()
        assert ser_cls is not None

        ser = ser_cls(data={})
        assert not ser.is_valid()
        assert "code" in ser.errors
        assert "state" in ser.errors

        ser = ser_cls(data={"code": "abc", "state": "xyz"})
        assert ser.is_valid()


@control_silo_test
class OAuth2ApiStepHandlePostTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.request = RequestFactory().get("/")

    @cached_property
    def step(self) -> OAuth2ApiStep:
        return OAuth2ApiStep(
            authorize_url="https://example.org/oauth2/authorize",
            client_id="123456",
            client_secret="secret-value",
            access_token_url="https://example.org/oauth/token",
            scope="all-the-things",
            redirect_url="/extensions/default/setup/",
        )

    @responses.activate
    def test_exchange_token_success(self) -> None:
        responses.add(
            responses.POST,
            "https://example.org/oauth/token",
            json={"access_token": "a-fake-token"},
        )
        ctx = cast(Pipeline, _FakePipelineContext(signature="valid-state"))
        result = self.step.handle_post(
            {"code": "auth-code", "state": "valid-state"}, ctx, self.request
        )

        assert result.action == PipelineStepAction.ADVANCE
        assert ctx.fetch_state("data") == {"access_token": "a-fake-token"}

        assert len(responses.calls) == 1
        data = dict(parse_qsl(responses.calls[0].request.body))
        assert data["grant_type"] == "authorization_code"
        assert data["code"] == "auth-code"
        assert data["client_id"] == "123456"
        assert data["client_secret"] == "secret-value"

    def test_invalid_state(self) -> None:
        ctx = cast(Pipeline, _FakePipelineContext(signature="correct-state"))
        result = self.step.handle_post(
            {"code": "auth-code", "state": "wrong-state"}, ctx, self.request
        )

        assert result.action == PipelineStepAction.ERROR
        assert "detail" in result.data

    @responses.activate
    def test_ssl_error(self) -> None:
        def ssl_error(request):
            raise SSLError("Could not build connection")

        responses.add_callback(
            responses.POST, "https://example.org/oauth/token", callback=ssl_error
        )
        ctx = cast(Pipeline, _FakePipelineContext(signature="valid-state"))
        result = self.step.handle_post(
            {"code": "auth-code", "state": "valid-state"}, ctx, self.request
        )

        assert result.action == PipelineStepAction.ERROR
        assert "SSL" in result.data["detail"]

    @responses.activate
    def test_connection_error(self) -> None:
        def connection_error(request):
            raise ConnectionError("Name or service not known")

        responses.add_callback(
            responses.POST, "https://example.org/oauth/token", callback=connection_error
        )
        ctx = cast(Pipeline, _FakePipelineContext(signature="valid-state"))
        result = self.step.handle_post(
            {"code": "auth-code", "state": "valid-state"}, ctx, self.request
        )

        assert result.action == PipelineStepAction.ERROR
        assert "connect" in result.data["detail"].lower()

    @responses.activate
    def test_empty_response_body(self) -> None:
        responses.add(responses.POST, "https://example.org/oauth/token", body="")
        ctx = cast(Pipeline, _FakePipelineContext(signature="valid-state"))
        result = self.step.handle_post(
            {"code": "auth-code", "state": "valid-state"}, ctx, self.request
        )

        assert result.action == PipelineStepAction.ERROR
        assert "json" in result.data["detail"].lower()

    @responses.activate
    def test_api_error_401(self) -> None:
        responses.add(
            responses.POST,
            "https://example.org/oauth/token",
            json={"error": "unauthorized"},
            status=401,
        )
        ctx = cast(Pipeline, _FakePipelineContext(signature="valid-state"))
        result = self.step.handle_post(
            {"code": "auth-code", "state": "valid-state"}, ctx, self.request
        )

        assert result.action == PipelineStepAction.ERROR
        assert "401" in result.data["detail"]
