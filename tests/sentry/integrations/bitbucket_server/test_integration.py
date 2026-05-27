from functools import cached_property
from typing import Any
from unittest.mock import MagicMock, patch

import responses
from django.urls import reverse
from requests.exceptions import ReadTimeout

from fixtures.bitbucket_server import EXAMPLE_PRIVATE_KEY
from sentry.integrations.bitbucket_server.integration import BitbucketServerIntegrationProvider
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.models.repository import Repository
from sentry.silo.base import SiloMode
from sentry.testutils.asserts import assert_failure_metric
from sentry.testutils.cases import APITestCase, IntegrationTestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.users.models.identity import Identity, IdentityProvider


@control_silo_test
class BitbucketServerIntegrationTest(IntegrationTestCase):
    provider = BitbucketServerIntegrationProvider

    @cached_property
    @assume_test_silo_mode(SiloMode.CONTROL)
    def integration(self):
        integration = Integration.objects.create(
            provider=self.provider.key,
            name="Bitbucket Server",
            external_id="bitbucket_server:1",
            metadata={
                "base_url": "https://bitbucket.example.com",
                "domain_name": "bitbucket.example.com",
            },
        )
        integration.add_organization(self.organization, self.user)
        return integration

    def test_config_view(self) -> None:
        resp = self.client.get(self.init_path)
        assert resp.status_code == 200

        resp = self.client.get(self.setup_path)
        assert resp.status_code == 200
        self.assertContains(resp, "Connect Sentry")
        self.assertContains(resp, "Submit</button>")

    @responses.activate
    def test_validate_url(self) -> None:
        # Start pipeline and go to setup page.
        self.client.get(self.setup_path)

        # Submit credentials
        data = {
            "url": "bitbucket.example.com/",
            "verify_ssl": False,
            "consumer_key": "sentry-bot",
            "private_key": EXAMPLE_PRIVATE_KEY,
        }
        resp = self.client.post(self.setup_path, data=data)
        assert resp.status_code == 200
        self.assertContains(resp, "Enter a valid URL")

    @responses.activate
    def test_validate_private_key(self) -> None:
        responses.add(
            responses.POST,
            "https://bitbucket.example.com/plugins/servlet/oauth/request-token",
            status=503,
        )

        # Start pipeline and go to setup page.
        self.client.get(self.setup_path)

        # Submit credentials
        data = {
            "url": "https://bitbucket.example.com/",
            "verify_ssl": False,
            "consumer_key": "sentry-bot",
            "private_key": "hot-garbage",
        }
        resp = self.client.post(self.setup_path, data=data)
        assert resp.status_code == 200
        self.assertContains(
            resp, "Private key must be a valid SSH private key encoded in a PEM format."
        )

    @responses.activate
    def test_validate_consumer_key_length(self) -> None:
        # Start pipeline and go to setup page.
        self.client.get(self.setup_path)

        # Submit credentials
        data = {
            "url": "bitbucket.example.com/",
            "verify_ssl": False,
            "consumer_key": "x" * 201,
            "private_key": EXAMPLE_PRIVATE_KEY,
        }
        resp = self.client.post(self.setup_path, data=data)
        assert resp.status_code == 200
        self.assertContains(resp, "Consumer key is limited to 200")

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_authentication_request_token_timeout(self, mock_record: MagicMock) -> None:
        timeout = ReadTimeout("Read timed out. (read timeout=30)")
        responses.add(
            responses.POST,
            "https://bitbucket.example.com/plugins/servlet/oauth/request-token",
            body=timeout,
        )

        # Start pipeline and go to setup page.
        self.client.get(self.setup_path)

        # Submit credentials
        data = {
            "url": "https://bitbucket.example.com/",
            "verify_ssl": False,
            "consumer_key": "sentry-bot",
            "private_key": EXAMPLE_PRIVATE_KEY,
        }
        resp = self.client.post(self.setup_path, data=data)
        assert resp.status_code == 200
        self.assertContains(resp, "Setup Error")
        self.assertContains(resp, "request token from Bitbucket")
        self.assertContains(resp, "Timed out")

        assert_failure_metric(
            mock_record, "Timed out attempting to reach host: bitbucket.example.com"
        )

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_authentication_request_token_fails(self, mock_record: MagicMock) -> None:
        responses.add(
            responses.POST,
            "https://bitbucket.example.com/plugins/servlet/oauth/request-token",
            status=503,
        )

        # Start pipeline and go to setup page.
        self.client.get(self.setup_path)

        # Submit credentials
        data = {
            "url": "https://bitbucket.example.com/",
            "verify_ssl": False,
            "consumer_key": "sentry-bot",
            "private_key": EXAMPLE_PRIVATE_KEY,
        }
        resp = self.client.post(self.setup_path, data=data)
        assert resp.status_code == 200
        self.assertContains(resp, "Setup Error")
        self.assertContains(resp, "request token from Bitbucket")

        assert_failure_metric(mock_record, "")

    @responses.activate
    def test_authentication_request_token_redirect(self) -> None:
        responses.add(
            responses.POST,
            "https://bitbucket.example.com/plugins/servlet/oauth/request-token",
            status=200,
            content_type="text/plain",
            body="oauth_token=abc123&oauth_token_secret=def456",
        )

        # Start pipeline
        self.client.get(self.init_path)

        # Submit credentials
        data = {
            "url": "https://bitbucket.example.com/",
            "verify_ssl": False,
            "consumer_key": "sentry-bot",
            "private_key": EXAMPLE_PRIVATE_KEY,
        }
        resp = self.client.post(self.setup_path, data=data)
        assert resp.status_code == 302
        redirect = (
            "https://bitbucket.example.com/plugins/servlet/oauth/authorize?oauth_token=abc123"
        )
        assert redirect == resp["Location"]

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_authentication_access_token_failure(self, mock_record: MagicMock) -> None:
        responses.add(
            responses.POST,
            "https://bitbucket.example.com/plugins/servlet/oauth/request-token",
            status=200,
            content_type="text/plain",
            body="oauth_token=abc123&oauth_token_secret=def456",
        )
        error_msg = "<html>it broke</html>"
        responses.add(
            responses.POST,
            "https://bitbucket.example.com/plugins/servlet/oauth/access-token",
            status=500,
            content_type="text/plain",
            body=error_msg,
        )

        # Get config page
        resp = self.client.get(self.init_path)
        assert resp.status_code == 200

        # Submit credentials
        data = {
            "url": "https://bitbucket.example.com/",
            "verify_ssl": False,
            "consumer_key": "sentry-bot",
            "private_key": EXAMPLE_PRIVATE_KEY,
        }
        resp = self.client.post(self.setup_path, data=data)
        assert resp.status_code == 302
        assert resp["Location"]

        resp = self.client.get(self.setup_path + "?oauth_token=xyz789")
        assert resp.status_code == 200
        self.assertContains(resp, "Setup Error")
        self.assertContains(resp, "access token from Bitbucket")

        assert_failure_metric(mock_record, error_msg)

    def install_integration(self):
        # Get config page
        resp = self.client.get(self.setup_path)
        assert resp.status_code == 200

        # Submit credentials
        data = {
            "url": "https://bitbucket.example.com/",
            "verify_ssl": False,
            "consumer_key": "sentry-bot",
            "private_key": EXAMPLE_PRIVATE_KEY,
        }
        resp = self.client.post(self.setup_path, data=data)
        assert resp.status_code == 302
        assert resp["Location"]

        resp = self.client.get(self.setup_path + "?oauth_token=xyz789")
        assert resp.status_code == 200

        return resp

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_authentication_verifier_expired(self, mock_record: MagicMock) -> None:
        responses.add(
            responses.POST,
            "https://bitbucket.example.com/plugins/servlet/oauth/request-token",
            status=200,
            content_type="text/plain",
            body="oauth_token=abc123&oauth_token_secret=def456",
        )
        error_msg = "oauth_error=token+expired"
        responses.add(
            responses.POST,
            "https://bitbucket.example.com/plugins/servlet/oauth/access-token",
            status=404,
            content_type="text/plain",
            body=error_msg,
        )

        # Try getting the token but it has expired for some reason,
        # perhaps a stale reload/history navigate.
        resp = self.install_integration()

        self.assertContains(resp, "Setup Error")
        self.assertContains(resp, "access token from Bitbucket")

        assert_failure_metric(mock_record, error_msg)

    @responses.activate
    def test_authentication_success(self) -> None:
        responses.add(
            responses.POST,
            "https://bitbucket.example.com/plugins/servlet/oauth/request-token",
            status=200,
            content_type="text/plain",
            body="oauth_token=abc123&oauth_token_secret=def456",
        )
        responses.add(
            responses.POST,
            "https://bitbucket.example.com/plugins/servlet/oauth/access-token",
            status=200,
            content_type="text/plain",
            body="oauth_token=valid-token&oauth_token_secret=valid-secret",
        )
        responses.add(
            responses.POST,
            "https://bitbucket.example.com/rest/webhooks/1.0/webhook",
            status=204,
            body="",
        )

        self.install_integration()

        integration = Integration.objects.get()
        assert integration.name == "sentry-bot"
        assert integration.metadata["domain_name"] == "bitbucket.example.com"
        assert integration.metadata["base_url"] == "https://bitbucket.example.com"
        assert integration.metadata["verify_ssl"] is False

        org_integration = OrganizationIntegration.objects.get(
            integration=integration, organization_id=self.organization.id
        )
        assert org_integration.config == {}

        idp = IdentityProvider.objects.get(type="bitbucket_server")
        identity = Identity.objects.get(
            idp=idp, user=self.user, external_id="bitbucket.example.com:sentry-bot"
        )
        assert identity.data["consumer_key"] == "sentry-bot"
        assert identity.data["access_token"] == "valid-token"
        assert identity.data["access_token_secret"] == "valid-secret"
        assert identity.data["private_key"] == EXAMPLE_PRIVATE_KEY

    @responses.activate
    def test_setup_external_id_length(self) -> None:
        responses.add(
            responses.POST,
            "https://bitbucket.example.com/plugins/servlet/oauth/request-token",
            status=200,
            content_type="text/plain",
            body="oauth_token=abc123&oauth_token_secret=def456",
        )
        responses.add(
            responses.POST,
            "https://bitbucket.example.com/plugins/servlet/oauth/access-token",
            status=200,
            content_type="text/plain",
            body="oauth_token=valid-token&oauth_token_secret=valid-secret",
        )
        responses.add(
            responses.POST,
            "https://bitbucket.example.com/rest/webhooks/1.0/webhook",
            status=204,
            body="",
        )

        # Start pipeline and go to setup page.
        self.client.get(self.setup_path)

        # Submit credentials
        data = {
            "url": "https://bitbucket.example.com/",
            "verify_ssl": False,
            "consumer_key": "a-very-long-consumer-key-that-when-combined-with-host-would-overflow",
            "private_key": EXAMPLE_PRIVATE_KEY,
        }
        resp = self.client.post(self.setup_path, data=data)
        assert resp.status_code == 302
        redirect = (
            "https://bitbucket.example.com/plugins/servlet/oauth/authorize?oauth_token=abc123"
        )
        assert redirect == resp["Location"]

        resp = self.client.get(self.setup_path + "?oauth_token=xyz789")
        assert resp.status_code == 200

        integration = Integration.objects.get(provider="bitbucket_server")
        assert (
            integration.external_id
            == "bitbucket.example.com:a-very-long-consumer-key-that-when-combine"
        )

    def test_source_url_matches(self) -> None:
        installation = self.integration.get_installation(self.organization.id)

        test_cases = [
            (
                "https://bitbucket.example.com/projects/TEST/repos/sentry/browse/src/sentry/integrations/bitbucket_server/integration.py?at=main",
                True,
            ),
            (
                "https://notbitbucket.example.com/projects/TEST/repos/sentry/browse/src/sentry/integrations/bitbucket_server/integration.py?at=main",
                False,
            ),
            (
                "https://jianyuan.io",
                False,
            ),
        ]

        for source_url, matches in test_cases:
            assert installation.source_url_matches(source_url) == matches

    def test_format_source_url(self) -> None:
        installation = self.integration.get_installation(self.organization.id)

        with assume_test_silo_mode(SiloMode.CELL):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="TEST/sentry",
                url="https://bitbucket.example.com/projects/TEST/repos/sentry/browse",
                provider=self.provider.key,
                external_id=123,
                config={"name": "TEST/sentry", "project": "TEST", "repo": "sentry"},
                integration_id=self.integration.id,
            )

        assert (
            installation.format_source_url(
                repo, "src/sentry/integrations/bitbucket_server/integration.py", None
            )
            == "https://bitbucket.example.com/projects/TEST/repos/sentry/browse/src/sentry/integrations/bitbucket_server/integration.py"
        )
        assert (
            installation.format_source_url(
                repo, "src/sentry/integrations/bitbucket_server/integration.py", "main"
            )
            == "https://bitbucket.example.com/projects/TEST/repos/sentry/browse/src/sentry/integrations/bitbucket_server/integration.py?at=main"
        )

    def test_extract_branch_from_source_url(self) -> None:
        installation = self.integration.get_installation(self.organization.id)

        with assume_test_silo_mode(SiloMode.CELL):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="TEST/sentry",
                url="https://bitbucket.example.com/projects/TEST/repos/sentry/browse",
                provider=self.provider.key,
                external_id=123,
                config={"name": "TEST/sentry", "project": "TEST", "repo": "sentry"},
                integration_id=self.integration.id,
            )

        # ?at=main
        assert (
            installation.extract_branch_from_source_url(
                repo,
                "https://bitbucket.example.com/projects/TEST/repos/sentry/browse/src/sentry/integrations/bitbucket_server/integration.py?at=main",
            )
            == "main"
        )
        # ?at=refs/heads/main
        assert (
            installation.extract_branch_from_source_url(
                repo,
                "https://bitbucket.example.com/projects/TEST/repos/sentry/browse/src/sentry/integrations/bitbucket_server/integration.py?at=refs%2Fheads%2Fmain",
            )
            == "main"
        )

    def test_extract_source_path_from_source_url(self) -> None:
        installation = self.integration.get_installation(self.organization.id)

        with assume_test_silo_mode(SiloMode.CELL):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="TEST/sentry",
                url="https://bitbucket.example.com/projects/TEST/repos/sentry/browse",
                provider=self.provider.key,
                external_id=123,
                config={"name": "TEST/sentry", "project": "TEST", "repo": "sentry"},
                integration_id=self.integration.id,
            )

        test_cases = [
            (
                "https://bitbucket.example.com/projects/TEST/repos/sentry/browse/src/sentry/integrations/bitbucket_server/integration.py",
                "src/sentry/integrations/bitbucket_server/integration.py",
            ),
            (
                "https://bitbucket.example.com/projects/TEST/repos/sentry/browse/src/sentry/integrations/bitbucket_server/integration.py?at=main",
                "src/sentry/integrations/bitbucket_server/integration.py",
            ),
            (
                "https://bitbucket.example.com/projects/TEST/repos/sentry/browse/src/sentry/integrations/bitbucket_server/integration.py?at=refs%2Fheads%2Fmain",
                "src/sentry/integrations/bitbucket_server/integration.py",
            ),
        ]
        for source_url, expected in test_cases:
            assert installation.extract_source_path_from_source_url(repo, source_url) == expected


REQUEST_TOKEN_BODY = "oauth_token=req-token&oauth_token_secret=req-token-secret"
ACCESS_TOKEN_BODY = "oauth_token=valid-token&oauth_token_secret=valid-secret"


@control_silo_test
class BitbucketServerApiPipelineTest(APITestCase):
    endpoint = "sentry-api-0-organization-pipeline"
    method = "post"

    bbs_url = "https://bitbucket.example.com"

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
            data={"action": "initialize", "provider": "bitbucket_server"},
            format="json",
        )

    def _advance(self, data: dict[str, Any]) -> Any:
        return self.client.post(self._pipeline_url(), data=data, format="json")

    def _submit_config(self, **overrides: Any) -> Any:
        data = {
            "url": self.bbs_url,
            "consumerKey": "sentry-bot",
            "privateKey": EXAMPLE_PRIVATE_KEY,
            "verifySsl": False,
        }
        data.update(overrides)
        return self._advance(data)

    def _stub_request_token(self, **kwargs: Any) -> None:
        responses.add(
            responses.POST,
            f"{self.bbs_url}/plugins/servlet/oauth/request-token",
            status=kwargs.pop("status", 200),
            content_type="text/plain",
            body=kwargs.pop("body", REQUEST_TOKEN_BODY),
            **kwargs,
        )

    def _stub_access_token(self, **kwargs: Any) -> None:
        responses.add(
            responses.POST,
            f"{self.bbs_url}/plugins/servlet/oauth/access-token",
            status=kwargs.pop("status", 200),
            content_type="text/plain",
            body=kwargs.pop("body", ACCESS_TOKEN_BODY),
            **kwargs,
        )

    @responses.activate
    def test_initialize_pipeline(self) -> None:
        resp = self._initialize()
        assert resp.status_code == 200
        assert resp.data["provider"] == "bitbucket_server"
        assert resp.data["step"] == "installation_config"
        assert resp.data["stepIndex"] == 0
        assert resp.data["totalSteps"] == 2
        assert resp.data["data"] == {}

    @responses.activate
    def test_config_step_validation_missing_required_fields(self) -> None:
        self._initialize()
        resp = self._advance({"url": self.bbs_url})
        assert resp.status_code == 400
        for field in ("consumerKey", "privateKey"):
            assert resp.data[field] == ["This field is required."]

    @responses.activate
    def test_config_step_validation_invalid_url(self) -> None:
        self._initialize()
        resp = self._submit_config(url="bitbucket.example.com")
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
            f"{self.bbs_url}/plugins/servlet/oauth/authorize?oauth_token=req-token"
        )

    @responses.activate
    def test_config_step_strips_trailing_slash(self) -> None:
        self._stub_request_token()
        self._initialize()
        resp = self._submit_config(url=f"{self.bbs_url}//")
        assert resp.status_code == 200
        assert resp.data["status"] == "advance"
        assert resp.data["data"]["oauthUrl"] == (
            f"{self.bbs_url}/plugins/servlet/oauth/authorize?oauth_token=req-token"
        )

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_config_step_request_token_timeout(self, mock_record: MagicMock) -> None:
        responses.add(
            responses.POST,
            f"{self.bbs_url}/plugins/servlet/oauth/request-token",
            body=ReadTimeout("Read timed out. (read timeout=30)"),
        )
        self._initialize()
        resp = self._submit_config()
        assert resp.status_code == 400
        assert resp.data["status"] == "error"
        assert "request token from Bitbucket" in resp.data["data"]["detail"]
        assert_failure_metric(
            mock_record, "Timed out attempting to reach host: bitbucket.example.com"
        )

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_config_step_request_token_fails(self, mock_record: MagicMock) -> None:
        self._stub_request_token(status=503, body="")
        self._initialize()
        resp = self._submit_config()
        assert resp.status_code == 400
        assert resp.data["status"] == "error"
        assert "request token from Bitbucket" in resp.data["data"]["detail"]
        assert_failure_metric(mock_record, "")

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
        # Bitbucket Server uses the callback's oauth_token as the OAuth 1.0a
        # verifier when exchanging for an access token. Confirm the access-token
        # request signature contains the value from the callback.
        self._stub_request_token()
        self._stub_access_token()
        self._initialize()
        self._submit_config()
        self._advance({"oauthToken": "callback-token"})

        access_token_calls = [
            call
            for call in responses.calls
            if call.request.url == f"{self.bbs_url}/plugins/servlet/oauth/access-token"
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
        assert "access token from Bitbucket" in resp.data["data"]["detail"]
        assert_failure_metric(mock_record, error_msg)

    @responses.activate
    def test_full_pipeline_flow(self) -> None:
        self._stub_request_token()
        self._stub_access_token()

        resp = self._initialize()
        assert resp.data["step"] == "installation_config"

        resp = self._submit_config()
        assert resp.data["step"] == "oauth_callback"

        resp = self._advance({"oauthToken": "callback-token"})
        assert resp.status_code == 200
        assert resp.data["status"] == "complete"

        integration = Integration.objects.get(provider="bitbucket_server")
        assert integration.name == "sentry-bot"
        assert integration.external_id == "bitbucket.example.com:sentry-bot"
        assert integration.metadata["base_url"] == self.bbs_url
        assert integration.metadata["domain_name"] == "bitbucket.example.com"
        assert integration.metadata["verify_ssl"] is False

        assert OrganizationIntegration.objects.filter(
            integration=integration, organization_id=self.organization.id
        ).exists()

        idp = IdentityProvider.objects.get(type="bitbucket_server")
        identity = Identity.objects.get(
            idp=idp, user=self.user, external_id="bitbucket.example.com:sentry-bot"
        )
        assert identity.data["consumer_key"] == "sentry-bot"
        assert identity.data["access_token"] == "valid-token"
        assert identity.data["access_token_secret"] == "valid-secret"
        assert identity.data["private_key"] == EXAMPLE_PRIVATE_KEY

    @responses.activate
    def test_full_pipeline_truncates_external_id(self) -> None:
        self._stub_request_token()
        self._stub_access_token()

        self._initialize()
        long_key = "a-very-long-consumer-key-that-when-combined-with-host-would-overflow"
        self._submit_config(consumerKey=long_key)
        self._advance({"oauthToken": "callback-token"})

        integration = Integration.objects.get(provider="bitbucket_server")
        assert (
            integration.external_id
            == "bitbucket.example.com:a-very-long-consumer-key-that-when-combine"
        )
