import orjson
import responses
from django.test import override_settings
from requests import Request

from fixtures.bitbucket_server import REPO
from sentry.integrations.bitbucket_server.client import (
    BitbucketServerAPIPath,
    BitbucketServerClient,
)
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
class BitbucketServerClientTest(TestCase, BaseTestCase):
    def setUp(self):
        self.integration = self.create_provider_integration(
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
            assert hc in request.headers["Authorization"]

    @responses.activate
    def test_get_repo_authentication(self):
        responses.add(
            responses.GET,
            f"{self.bb_server_client.base_url}{BitbucketServerAPIPath.repository.format(project='laurynsentry', repo='helloworld')}",
            body=orjson.dumps(REPO),
        )

        res = self.bb_server_client.get_repo("laurynsentry", "helloworld")

        assert isinstance(res, dict)
        assert res["slug"] == "helloworld"

        assert len(responses.calls) == 1
        assert "oauth_consumer_key" in responses.calls[0].request.headers["Authorization"]
