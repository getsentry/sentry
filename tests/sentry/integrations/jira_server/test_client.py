from django.test import override_settings
from requests import Request

from sentry.integrations.jira_server.client import JiraServerClient
from sentry.testutils.cases import BaseTestCase, TestCase
from sentry.testutils.silo import control_silo_test
from tests.sentry.integrations.jira_server import EXAMPLE_PRIVATE_KEY

control_address = "http://controlserver"
secret = "hush-hush-im-invisible"


@override_settings(
    SENTRY_SUBNET_SECRET=secret,
    SENTRY_CONTROL_ADDRESS=control_address,
)
@control_silo_test
class JiraServerClientTest(TestCase, BaseTestCase):
    def setUp(self):
        self.integration = self.create_provider_integration(
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
