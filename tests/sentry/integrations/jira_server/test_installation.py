from typing import Any
from unittest.mock import MagicMock, patch

import responses
from django.urls import reverse
from requests.exceptions import ReadTimeout

from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.testutils.asserts import assert_failure_metric
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.identity import Identity, IdentityProvider

from . import EXAMPLE_PRIVATE_KEY

REQUEST_TOKEN_BODY = "oauth_token=req-token&oauth_token_secret=req-token-secret"
ACCESS_TOKEN_BODY = "oauth_token=valid-token&oauth_token_secret=valid-secret"


@control_silo_test
class JiraServerApiPipelineTest(APITestCase):
    endpoint = "sentry-api-0-organization-pipeline"
    method = "post"

    jira_url = "https://jira.example.com"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def tearDown(self) -> None:
        responses.reset()
        super().tearDown()

    def _pipeline_url(self) -> str:
        return reverse(
            self.endpoint,
            args=[self.organization.slug, IntegrationPipeline.pipeline_name],
        )

    def _initialize(self) -> Any:
        return self.client.post(
            self._pipeline_url(),
            data={"action": "initialize", "provider": "jira_server"},
            format="json",
        )

    def _advance(self, data: dict[str, Any]) -> Any:
        return self.client.post(self._pipeline_url(), data=data, format="json")

    def _submit_config(self, **overrides: Any) -> Any:
        data = {
            "url": self.jira_url,
            "consumerKey": "sentry-bot",
            "privateKey": EXAMPLE_PRIVATE_KEY,
            "verifySsl": False,
        }
        data.update(overrides)
        return self._advance(data)

    def _stub_request_token(self, **kwargs: Any) -> None:
        responses.add(
            responses.POST,
            f"{self.jira_url}/plugins/servlet/oauth/request-token",
            status=kwargs.pop("status", 200),
            content_type="text/plain",
            body=kwargs.pop("body", REQUEST_TOKEN_BODY),
            **kwargs,
        )

    def _stub_access_token(self, **kwargs: Any) -> None:
        responses.add(
            responses.POST,
            f"{self.jira_url}/plugins/servlet/oauth/access-token",
            status=kwargs.pop("status", 200),
            content_type="text/plain",
            body=kwargs.pop("body", ACCESS_TOKEN_BODY),
            **kwargs,
        )

    def _stub_install_endpoints(self, **kwargs: Any) -> None:
        responses.add(
            responses.GET,
            f"{self.jira_url}/rest/api/2/serverInfo",
            status=200,
            json={"baseUrl": self.jira_url, "version": "9.9.9"},
        )
        responses.add(
            responses.POST,
            f"{self.jira_url}/rest/webhooks/1.0/webhook",
            status=kwargs.pop("webhook_status", 204),
            body=kwargs.pop("webhook_body", ""),
            json=kwargs.pop("webhook_json", None),
        )

    @responses.activate
    def test_initialize_pipeline(self) -> None:
        resp = self._initialize()
        assert resp.status_code == 200
        assert resp.data["provider"] == "jira_server"
        assert resp.data["step"] == "installation_config"
        assert resp.data["stepIndex"] == 0
        assert resp.data["totalSteps"] == 2
        assert resp.data["data"] == {}

    @responses.activate
    def test_config_step_validation_missing_required_fields(self) -> None:
        self._initialize()
        resp = self._advance({"url": self.jira_url})
        assert resp.status_code == 400
        for field in ("consumerKey", "privateKey"):
            assert resp.data[field] == ["This field is required."]

    @responses.activate
    def test_config_step_validation_invalid_url(self) -> None:
        self._initialize()
        resp = self._submit_config(url="jira.example.com")
        assert resp.status_code == 400
        assert resp.data["url"] == ["Enter a valid URL."]

    @responses.activate
    def test_config_step_validation_invalid_private_key(self) -> None:
        self._initialize()
        resp = self._submit_config(privateKey="hot-garbage")
        assert resp.status_code == 400
        assert "PEM format" in resp.data["privateKey"][0]

    @responses.activate
    def test_config_step_validation_consumer_key_too_long(self) -> None:
        self._initialize()
        resp = self._submit_config(consumerKey="x" * 201)
        assert resp.status_code == 400
        assert "200 characters" in resp.data["consumerKey"][0]

    @responses.activate
    def test_config_step_advance(self) -> None:
        self._stub_request_token()
        self._initialize()
        resp = self._submit_config()
        assert resp.status_code == 200
        assert resp.data["status"] == "advance"
        assert resp.data["step"] == "oauth_callback"
        assert resp.data["stepIndex"] == 1
        assert resp.data["data"]["oauthUrl"] == (
            f"{self.jira_url}/plugins/servlet/oauth/authorize?oauth_token=req-token"
        )

    @responses.activate
    def test_config_step_strips_trailing_slash(self) -> None:
        self._stub_request_token()
        self._initialize()
        resp = self._submit_config(url=f"{self.jira_url}//")
        assert resp.status_code == 200
        assert resp.data["status"] == "advance"
        assert resp.data["data"]["oauthUrl"] == (
            f"{self.jira_url}/plugins/servlet/oauth/authorize?oauth_token=req-token"
        )

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_config_step_request_token_timeout(self, mock_record: MagicMock) -> None:
        responses.add(
            responses.POST,
            f"{self.jira_url}/plugins/servlet/oauth/request-token",
            body=ReadTimeout("Read timed out. (read timeout=30)"),
        )
        self._initialize()
        resp = self._submit_config()
        assert resp.status_code == 400
        assert resp.data["status"] == "error"
        assert "request token from Jira" in resp.data["data"]["detail"]
        assert_failure_metric(mock_record, "Timed out attempting to reach host: jira.example.com")

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_config_step_request_token_fails(self, mock_record: MagicMock) -> None:
        self._stub_request_token(status=503, body="")
        self._initialize()
        resp = self._submit_config()
        assert resp.status_code == 400
        assert resp.data["status"] == "error"
        assert "request token from Jira" in resp.data["data"]["detail"]

    @responses.activate
    def test_config_step_missing_oauth_token(self) -> None:
        self._stub_request_token(body="no_token=oops&foo=bar")
        self._initialize()
        resp = self._submit_config()
        assert resp.status_code == 400
        assert resp.data["status"] == "error"
        assert resp.data["data"]["detail"] == "Missing oauth_token"

    @responses.activate
    def test_config_step_missing_oauth_token_secret(self) -> None:
        # A response with a token but no secret must fail here rather than
        # raising a KeyError later when the access token is exchanged.
        self._stub_request_token(body="oauth_token=req-token")
        self._initialize()
        resp = self._submit_config()
        assert resp.status_code == 400
        assert resp.data["status"] == "error"
        assert resp.data["data"]["detail"] == "Missing oauth_token"

    @responses.activate
    def test_oauth_step_validation_missing_token(self) -> None:
        self._stub_request_token()
        self._initialize()
        self._submit_config()
        resp = self._advance({})
        assert resp.status_code == 400
        assert resp.data["oauthToken"] == ["This field is required."]

    @responses.activate
    def test_oauth_step_passes_callback_token_as_verifier(self) -> None:
        # Jira Server uses the callback's oauth_token as the OAuth 1.0a verifier
        # when exchanging for an access token. Confirm the access-token request
        # signature contains the value from the callback.
        self._stub_request_token()
        self._stub_access_token()
        self._stub_install_endpoints()
        self._initialize()
        self._submit_config()
        self._advance({"oauthToken": "callback-token"})

        access_token_calls = [
            call
            for call in responses.calls
            if call.request.url == f"{self.jira_url}/plugins/servlet/oauth/access-token"
        ]
        assert len(access_token_calls) == 1
        assert (
            'oauth_verifier="callback-token"'
            in access_token_calls[0].request.headers["Authorization"]
        )

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_oauth_step_access_token_failure(self, mock_record: MagicMock) -> None:
        self._stub_request_token()
        error_msg = "<html>it broke</html>"
        self._stub_access_token(status=500, body=error_msg)
        self._initialize()
        self._submit_config()

        resp = self._advance({"oauthToken": "callback-token"})
        assert resp.status_code == 400
        assert resp.data["status"] == "error"
        assert "access token from Jira" in resp.data["data"]["detail"]
        assert_failure_metric(mock_record, error_msg)

    @responses.activate
    def test_full_pipeline_flow(self) -> None:
        self._stub_request_token()
        self._stub_access_token()
        self._stub_install_endpoints()

        resp = self._initialize()
        assert resp.data["step"] == "installation_config"

        resp = self._submit_config()
        assert resp.data["step"] == "oauth_callback"

        resp = self._advance({"oauthToken": "callback-token"})
        assert resp.status_code == 200
        assert resp.data["status"] == "complete"

        integration = Integration.objects.get(provider="jira_server")
        assert integration.name == "sentry-bot"
        assert integration.external_id == "jira.example.com:sentry-bot"
        assert integration.metadata["base_url"] == self.jira_url
        assert integration.metadata["domain_name"] == "jira.example.com"
        assert integration.metadata["verify_ssl"] is False
        assert integration.metadata["webhook_secret"]

        assert OrganizationIntegration.objects.filter(
            integration=integration, organization_id=self.organization.id
        ).exists()

        idp = IdentityProvider.objects.get(type="jira_server")
        identity = Identity.objects.get(
            idp=idp, user=self.user, external_id="jira.example.com:sentry-bot"
        )
        assert identity.data["consumer_key"] == "sentry-bot"
        assert identity.data["access_token"] == "valid-token"
        assert identity.data["access_token_secret"] == "valid-secret"
        assert identity.data["private_key"] == EXAMPLE_PRIVATE_KEY

    @responses.activate
    def test_full_pipeline_truncates_external_id(self) -> None:
        self._stub_request_token()
        self._stub_access_token()
        self._stub_install_endpoints()

        self._initialize()
        long_key = "a-very-long-consumer-key-that-when-combined-with-host-would-overflow"
        self._submit_config(consumerKey=long_key)
        self._advance({"oauthToken": "callback-token"})

        integration = Integration.objects.get(provider="jira_server")
        assert (
            integration.external_id
            == "jira.example.com:a-very-long-consumer-key-that-when-combined-wit"
        )

    @responses.activate
    def test_full_pipeline_webhook_failure(self) -> None:
        self._stub_request_token()
        self._stub_access_token()
        self._stub_install_endpoints(webhook_status=502, webhook_body="Bad things")

        self._initialize()
        self._submit_config()
        resp = self._advance({"oauthToken": "callback-token"})
        assert resp.status_code == 400
        assert resp.data["status"] == "error"
        assert "webhook" in resp.data["data"]["detail"]

        assert Integration.objects.count() == 0
