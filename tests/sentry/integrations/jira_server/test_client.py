import re

import responses
from django.test import override_settings
from requests import Request

from sentry.integrations.jira_server.client import JiraServerClient
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
class JiraServerClientTest(TestCase, BaseTestCase):
    def setUp(self):
        self.integration = Integration.objects.create(
            provider="jira_server",
            name="Jira Server",
            metadata={"base_url": "https://jira.example.com", "verify_ssl": True},
        )

        idp = self.create_identity_provider(integration=self.integration)
        self.identity = self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="jira:123",
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
        install = self.integration.get_installation(self.organization.id)
        self.jira_server_client: JiraServerClient = install.get_client()

    def test_authorize_request(self):
        method = "GET"
        request = Request(
            method=method,
            url=f"{self.jira_server_client.base_url}{self.jira_server_client.SERVER_INFO_URL}",
        ).prepare()

        self.jira_server_client.authorize_request(prepared_request=request)
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
        class JiraServerProxyTestClient(JiraServerClient):
            _use_proxy_url_for_tests = True

            def assert_proxy_request(self, request, is_proxy=True):
                assert (PROXY_BASE_PATH in request.url) == is_proxy
                assert (PROXY_OI_HEADER in request.headers) == is_proxy
                assert (PROXY_SIGNATURE_HEADER in request.headers) == is_proxy
                assert ("Authorization" in request.headers) != is_proxy
                if is_proxy:
                    assert request.headers[PROXY_OI_HEADER] is not None

        jira_response = responses.add(
            method=responses.GET,
            url=re.compile(rf"\S+{self.jira_server_client.SERVER_INFO_URL}$"),
            json={"ok": True},
            status=200,
        )

        control_proxy_response = add_control_silo_proxy_response(
            method=responses.GET,
            path=self.jira_server_client.SERVER_INFO_URL,
            json={"ok": True},
            status=200,
        )

        with override_settings(SILO_MODE=SiloMode.MONOLITH):
            client = JiraServerProxyTestClient(
                integration=self.integration, identity_id=self.identity.id
            )
            client.get_server_info()
            request = responses.calls[0].request

            assert client.SERVER_INFO_URL in request.url
            assert client.base_url in request.url
            assert jira_response.call_count == 1
            client.assert_proxy_request(request, is_proxy=False)

        responses.calls.reset()
        with override_settings(SILO_MODE=SiloMode.CONTROL):
            client = JiraServerProxyTestClient(
                integration=self.integration, identity_id=self.identity.id
            )
            client.get_server_info()
            request = responses.calls[0].request

            assert client.SERVER_INFO_URL in request.url
            assert jira_response.call_count == 2
            assert client.base_url in request.url
            client.assert_proxy_request(request, is_proxy=False)

        responses.calls.reset()
        assert control_proxy_response.call_count == 0
        with override_settings(SILO_MODE=SiloMode.REGION):
            client = JiraServerProxyTestClient(
                integration=self.integration, identity_id=self.identity.id
            )
            client.get_server_info()
            request = responses.calls[0].request

            assert control_proxy_response.call_count == 1
            assert client.base_url not in request.url
            client.assert_proxy_request(request, is_proxy=True)
