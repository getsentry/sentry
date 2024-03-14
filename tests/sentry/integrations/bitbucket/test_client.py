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


@control_silo_test
class BitbucketApiClientTest(TestCase, BaseTestCase):
    def setUp(self):
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
    def test_finalize_request(self):
        method = "GET"
        username = self.integration.metadata["uuid"]
        path = BitbucketAPIPath.repositories.format(username=username)
        params = {"q": 'name~"fuzzy-repo-name"'}
        prepared_request = Request(
            method=method, url=f"{self.bitbucket_client.base_url}{path}", params=params
        ).prepare()
        self.bitbucket_client.finalize_request(prepared_request=prepared_request)
        raw_jwt = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJ0ZXN0c2VydmVyLmJpdGJ1Y2tldCIsImlhdCI6MTY3MjUzNDg2MSwiZXhwIjoxNjcyNTM1MTYxLCJxc2giOiJiMGQxYzk0NjRhZGZhOWZlYzg5ZjRmMGM3YjY5MzAxMmZhYTdmN2EyMDRkNzU5NjJkY2FjZGRhM2M2MjY4NzViIiwic3ViIjoiY29ubmVjdGlvbjoxMjMifQ.E3xU7-AgZ2sM-s_yoGAiOGmFZQg63IJJ76YrDwk2qBw"
        assert prepared_request.headers["Authorization"] == f"JWT {raw_jwt}"

        decoded_jwt = jwt.decode(
            raw_jwt,
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
    def test_check_file(self):
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
    def test_check_no_file(self):
        path = "src/santry/integrations/bitbucket/client.py"
        version = "master"
        url = f"https://api.bitbucket.org/2.0/repositories/{self.repo.name}/src/{version}/{path}"

        responses.add(method=responses.HEAD, url=url, status=404)

        with pytest.raises(ApiError):
            self.bitbucket_client.check_file(self.repo, path, version)

    @responses.activate
    def test_get_stacktrace_link(self):
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
