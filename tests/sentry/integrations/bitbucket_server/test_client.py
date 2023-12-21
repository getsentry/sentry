import re

import responses
from django.test import override_settings
from requests import Request

from sentry.integrations.bitbucket_server.client import (
    BitbucketServerAPIPath,
    BitbucketServerClient,
)
from sentry.models.integrations.integration import Integration
from sentry.silo.base import SiloMode
from sentry.silo.util import PROXY_BASE_PATH, PROXY_OI_HEADER, PROXY_SIGNATURE_HEADER
from sentry.testutils.cases import BaseTestCase, TestCase
from sentry.testutils.silo import control_silo_test
from tests.sentry.integrations.jira_server import EXAMPLE_PRIVATE_KEY
from tests.sentry.integrations.test_helpers import add_control_silo_proxy_response

control_address = "http://controlserver"
secret = "hush-hush-im-invisible"


@override_settings(
    SENTRY_SUBNET_SECRET=secret,
    SENTRY_CONTROL_ADDRESS=control_address,
)
@control_silo_test
class BitbucketServerClientTest(TestCase, BaseTestCase):
    def setUp(self):
        self.integration = Integration.objects.create(
            provider="bitbucket_server",
            name="Bitbucket Server",
            metadata={"base_url": "https://bitbucket.example.com", "verify_ssl": True},
        )

        idp = self.create_identity_provider(integration=self.integration)
        self.identity = self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="bitbucket:123",
            data={
                "consumer_key": "cnsmr-key",
                "private_key": EXAMPLE_PRIVATE_KEY,
                "access_token": "acs-tkn",
                "access_token_secret": "acs-tkn-scrt",
            },
        )
        self.integration.add_organization(
            self.organization, self.user, default_auth_id=self.identity.id
        )
        self.install = self.integration.get_installation(self.organization.id)
        self.bb_server_client: BitbucketServerClient = self.install.get_client()

    def test_authorize_request(self):
        method = "GET"
        request = Request(
            method=method,
            url=f"{self.bb_server_client.base_url}{BitbucketServerAPIPath.repositories}",
        ).prepare()

        self.bb_server_client.authorize_request(prepared_request=request)
        consumer_key = self.identity.data["consumer_key"]
        access_token = self.identity.data["access_token"]
        header_components = [
            'oauth_signature_method="RSA-SHA1"',
            f'oauth_consumer_key="{consumer_key}"',
            f'oauth_token="{access_token}"',
            "oauth_signature",
        ]
        for hc in header_components:
            assert hc in str(request.headers["Authorization"])

    @responses.activate
    def test_integration_proxy_is_active(self):
        class BitbucketServerProxyTestClient(BitbucketServerClient):
            _use_proxy_url_for_tests = True

            def assert_proxy_request(self, request, is_proxy=True):
                assert (PROXY_BASE_PATH in request.url) == is_proxy
                assert (PROXY_OI_HEADER in request.headers) == is_proxy
                assert (PROXY_SIGNATURE_HEADER in request.headers) == is_proxy
                assert ("Authorization" in request.headers) != is_proxy
                if is_proxy:
                    assert request.headers[PROXY_OI_HEADER] is not None

        expected_header_path = (
            BitbucketServerAPIPath.repositories.lstrip("/") + "?limit=250&permission=REPO_ADMIN"
        )

        control_proxy_response = add_control_silo_proxy_response(
            method=responses.GET,
            path=expected_header_path,
            json={"ok": True},
            status=200,
        )

        jira_response = responses.add(
            method=responses.GET,
            url=re.compile(rf"\S+{BitbucketServerAPIPath.repositories}"),
            json={"ok": True},
        )

        with override_settings(SILO_MODE=SiloMode.MONOLITH):
            client = BitbucketServerProxyTestClient(
                integration=self.integration,
                identity_id=self.identity.id,
                org_integration_id=self.install.org_integration.id,
            )
            client.get_repos()
            request = responses.calls[0].request

            assert BitbucketServerAPIPath.repositories in request.url
            assert client.base_url in request.url
            assert jira_response.call_count == 1
            client.assert_proxy_request(request, is_proxy=False)

        responses.calls.reset()
        with override_settings(SILO_MODE=SiloMode.CONTROL):
            client = BitbucketServerProxyTestClient(
                integration=self.integration,
                identity_id=self.identity.id,
                org_integration_id=self.install.org_integration.id,
            )
            client.get_repos()
            request = responses.calls[0].request

            assert BitbucketServerAPIPath.repositories in request.url
            assert client.base_url in request.url
            assert jira_response.call_count == 2
            client.assert_proxy_request(request, is_proxy=False)

        responses.calls.reset()
        assert control_proxy_response.call_count == 0
        with override_settings(SILO_MODE=SiloMode.REGION):
            client = BitbucketServerProxyTestClient(
                integration=self.integration,
                identity_id=self.identity.id,
                org_integration_id=self.install.org_integration.id,
            )
            client.get_repos()
            request = responses.calls[0].request

            assert client.base_url not in request.url
            assert control_proxy_response.call_count == 1
            client.assert_proxy_request(request, is_proxy=True)
