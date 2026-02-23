import jwt
import pytest
import responses
from requests import Request

from sentry.integrations.bitbucket.client import BitbucketApiClient, BitbucketAPIPath
from sentry.integrations.bitbucket.integration import BitbucketIntegration
from sentry.integrations.utils.atlassian_connect import get_query_hash
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError
from sentry.shared_integrations.response.base import BaseApiResponse
from sentry.silo.base import SiloMode
from sentry.testutils.cases import BaseTestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test

control_address = "http://controlserver"
secret = "hush-hush-im-invisible"

BITBUCKET_CODEOWNERS = {
    "filepath": ".bitbucket/CODEOWNERS",
    "html_url": "https://bitbucket.org/sentryuser/newsdiffs/src/master/.bitbucket/CODEOWNERS",
    "raw": "docs/* @jianyuan @getsentry/ecosystem\n* @jianyuan\n",
}


@control_silo_test
class BitbucketApiClientTest(TestCase, BaseTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="connection:123",
            provider="bitbucket",
            metadata={
                "public_key": "public-key",
                "base_url": "https://api.bitbucket.org",
                "shared_secret": "a-big-secret",
                "domain_name": "bitbucket.org/test-org",
                "icon": "https://bitbucket.org/account/test-org/avatar/",
                "scopes": ["issue:write", "pullrequest", "webhook", "repository"],
                "uuid": "u-u-i-d",
                "type": "team",
            },
        )
        install = self.integration.get_installation(self.organization.id)
        assert isinstance(install, BitbucketIntegration)
        self.install = install
        self.bitbucket_client: BitbucketApiClient = self.install.get_client()

        with assume_test_silo_mode(SiloMode.REGION):
            self.repo = Repository.objects.create(
                provider="bitbucket",
                name="sentryuser/newsdiffs",
                organization_id=self.organization.id,
                config={"name": "sentryuser/newsdiffs"},
                integration_id=self.integration.id,
            )

    @freeze_time("2023-01-01 01:01:01")
    def test_finalize_request(self) -> None:
        method = "GET"
        username = self.integration.metadata["uuid"]
        path = BitbucketAPIPath.repositories.format(username=username)
        params = {"q": 'name~"fuzzy-repo-name"'}
        prepared_request = Request(
            method=method, url=f"{self.bitbucket_client.base_url}{path}", params=params
        ).prepare()
        self.bitbucket_client.finalize_request(prepared_request=prepared_request)

        # Extract JWT from Authorization header
        auth_header = prepared_request.headers["Authorization"]
        assert auth_header.startswith("JWT ")
        actual_jwt = auth_header.split(" ", 1)[1]

        decoded_jwt = jwt.decode(
            actual_jwt,
            key=self.integration.metadata["shared_secret"],
            algorithms=["HS256"],
        )
        assert decoded_jwt == {
            "exp": 1672535161,
            "iat": 1672534861,
            "iss": "testserver.bitbucket",
            "qsh": get_query_hash(uri=path, method=method, query_params=params),
            "sub": self.integration.external_id,
        }

    @responses.activate
    def test_check_file(self) -> None:
        path = "src/sentry/integrations/bitbucket/client.py"
        version = "master"
        url = f"https://api.bitbucket.org/2.0/repositories/{self.repo.name}/src/{version}/{path}"

        responses.add(
            method=responses.HEAD,
            url=url,
            json={"text": 200},
        )

        resp = self.bitbucket_client.check_file(self.repo, path, version)
        assert isinstance(resp, BaseApiResponse)
        assert resp.status_code == 200

    @responses.activate
    def test_check_no_file(self) -> None:
        path = "src/santry/integrations/bitbucket/client.py"
        version = "master"
        url = f"https://api.bitbucket.org/2.0/repositories/{self.repo.name}/src/{version}/{path}"

        responses.add(method=responses.HEAD, url=url, status=404)

        with pytest.raises(ApiError):
            self.bitbucket_client.check_file(self.repo, path, version)

    @responses.activate
    def test_get_stacktrace_link(self) -> None:
        path = "/src/sentry/integrations/bitbucket/client.py"
        version = "master"
        url = f"https://api.bitbucket.org/2.0/repositories/{self.repo.name}/src/{version}/{path.lstrip('/')}"

        responses.add(
            method=responses.HEAD,
            url=url,
            json={"text": 200},
        )

        source_url = self.install.get_stacktrace_link(self.repo, path, "master", version)
        assert (
            source_url
            == "https://bitbucket.org/sentryuser/newsdiffs/src/master/src/sentry/integrations/bitbucket/client.py"
        )

    @responses.activate
    def test_get_codeowner_file(self) -> None:
        self.config = self.create_code_mapping(
            repo=self.repo,
            project=self.project,
        )

        path = ".bitbucket/CODEOWNERS"
        url = f"https://api.bitbucket.org/2.0/repositories/{self.config.repository.name}/src/{self.config.default_branch}/{path}"

        responses.add(
            method=responses.HEAD,
            url=url,
            json={"text": 200},
        )
        responses.add(
            method=responses.GET,
            url=url,
            content_type="text/plain",
            body=BITBUCKET_CODEOWNERS["raw"],
        )

        result = self.install.get_codeowner_file(
            self.config.repository, ref=self.config.default_branch
        )
        assert result == BITBUCKET_CODEOWNERS
