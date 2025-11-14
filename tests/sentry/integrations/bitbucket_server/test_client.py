from typing import int
import orjson
import pytest
import responses
from django.test import override_settings
from requests import Request

from fixtures.bitbucket_server import REPO
from sentry.integrations.bitbucket_server.integration import BitbucketServerIntegration
from sentry.integrations.bitbucket_server.utils import BitbucketServerAPIPath
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError
from sentry.shared_integrations.response.base import BaseApiResponse
from sentry.silo.base import SiloMode
from sentry.testutils.cases import BaseTestCase, TestCase
from sentry.testutils.helpers.integrations import get_installation_of_type
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from tests.sentry.integrations.jira_server import EXAMPLE_PRIVATE_KEY

control_address = "http://controlserver"
secret = "hush-hush-im-invisible"

BITBUCKET_SERVER_CODEOWNERS = {
    "filepath": ".bitbucket/CODEOWNERS",
    "html_url": "https://bitbucket.example.com/projects/PROJ/repos/repository-name/browse/.bitbucket/CODEOWNERS?at=master",
    "raw": "docs/* @jianyuan @getsentry/ecosystem\n* @jianyuan\n",
}


@override_settings(
    SENTRY_SUBNET_SECRET=secret,
    SENTRY_CONTROL_ADDRESS=control_address,
)
@control_silo_test
class BitbucketServerClientTest(TestCase, BaseTestCase):
    def setUp(self) -> None:
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
        self.install = get_installation_of_type(
            BitbucketServerIntegration, self.integration, self.organization.id
        )
        self.bb_server_client = self.install.get_client()

        with assume_test_silo_mode(SiloMode.REGION):
            self.repo = Repository.objects.create(
                provider=self.integration.provider,
                name="PROJ/repository-name",
                organization_id=self.organization.id,
                config={
                    "name": "TEST/repository-name",
                    "project": "PROJ",
                    "repo": "repository-name",
                },
                integration_id=self.integration.id,
            )

    def test_authorize_request(self) -> None:
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
    def test_get_repo_authentication(self) -> None:
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

    @responses.activate
    def test_check_file(self) -> None:
        path = "src/sentry/integrations/bitbucket_server/client.py"
        version = "master"
        url = self.bb_server_client.base_url + BitbucketServerAPIPath.build_source(
            project=self.repo.config["project"],
            repo=self.repo.config["repo"],
            path=path,
            sha=version,
        )

        responses.add(
            responses.HEAD,
            url=url,
            status=200,
        )

        resp = self.bb_server_client.check_file(self.repo, path, version)
        assert isinstance(resp, BaseApiResponse)
        assert resp.status_code == 200

    @responses.activate
    def test_check_no_file(self) -> None:
        path = "src/santry/integrations/bitbucket_server/client.py"
        version = "master"
        url = self.bb_server_client.base_url + BitbucketServerAPIPath.build_source(
            project=self.repo.config["project"],
            repo=self.repo.config["repo"],
            path=path,
            sha=version,
        )

        responses.add(
            responses.HEAD,
            url=url,
            status=404,
        )

        with pytest.raises(ApiError):
            self.bb_server_client.check_file(self.repo, path, version)

    @responses.activate
    def test_get_file(self) -> None:
        path = "src/sentry/integrations/bitbucket_server/client.py"
        version = "master"
        url = self.bb_server_client.base_url + BitbucketServerAPIPath.build_raw(
            project=self.repo.config["project"],
            repo=self.repo.config["repo"],
            path=path,
            sha=version,
        )

        responses.add(
            responses.GET,
            url=url,
            body="Hello, world!",
            status=200,
        )

        resp = self.bb_server_client.get_file(self.repo, path, version)
        assert resp == "Hello, world!"

    @responses.activate
    def test_get_stacktrace_link(self) -> None:
        path = "src/sentry/integrations/bitbucket/client.py"
        version = "master"
        url = self.bb_server_client.base_url + BitbucketServerAPIPath.build_source(
            project=self.repo.config["project"],
            repo=self.repo.config["repo"],
            path=path,
            sha=version,
        )

        responses.add(
            method=responses.HEAD,
            url=url,
            status=200,
        )

        source_url = self.install.get_stacktrace_link(self.repo, path, "master", version)
        assert (
            source_url
            == "https://bitbucket.example.com/projects/PROJ/repos/repository-name/browse/src/sentry/integrations/bitbucket/client.py?at=master"
        )

    @responses.activate
    def test_get_codeowner_file(self) -> None:
        self.config = self.create_code_mapping(
            repo=self.repo,
            project=self.project,
        )

        path = ".bitbucket/CODEOWNERS"
        source_url = self.bb_server_client.base_url + BitbucketServerAPIPath.build_source(
            project=self.repo.config["project"],
            repo=self.repo.config["repo"],
            path=path,
            sha=self.config.default_branch,
        )
        raw_url = self.bb_server_client.base_url + BitbucketServerAPIPath.build_raw(
            project=self.repo.config["project"],
            repo=self.repo.config["repo"],
            path=path,
            sha=self.config.default_branch,
        )

        responses.add(
            method=responses.HEAD,
            url=source_url,
            status=200,
        )
        responses.add(
            method=responses.GET,
            url=raw_url,
            content_type="text/plain",
            body=BITBUCKET_SERVER_CODEOWNERS["raw"],
        )

        result = self.install.get_codeowner_file(
            self.config.repository, ref=self.config.default_branch
        )
        assert result == BITBUCKET_SERVER_CODEOWNERS
