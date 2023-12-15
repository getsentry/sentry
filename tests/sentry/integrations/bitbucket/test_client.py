import re

import jwt
import pytest
import responses
from django.test import override_settings
from requests import Request

from sentry.integrations.bitbucket.client import BitbucketApiClient, BitbucketAPIPath
from sentry.integrations.bitbucket.integration import BitbucketIntegration
from sentry.integrations.utils.atlassian_connect import get_query_hash
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError
from sentry.shared_integrations.response.base import BaseApiResponse
from sentry.silo.base import SiloMode
from sentry.silo.util import PROXY_BASE_PATH, PROXY_OI_HEADER, PROXY_SIGNATURE_HEADER
from sentry.testutils.cases import BaseTestCase, TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from tests.sentry.integrations.test_helpers import add_control_silo_proxy_response

control_address = "http://controlserver"
secret = "hush-hush-im-invisible"


@override_settings(
    SENTRY_SUBNET_SECRET=secret,
    SENTRY_CONTROL_ADDRESS=control_address,
)
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
    def test_authorize_request(self):
        method = "GET"
        username = self.integration.metadata["uuid"]
        path = BitbucketAPIPath.repositories.format(username=username)
        params = {"q": 'name~"fuzzy-repo-name"'}
        prepared_request = Request(
            method=method, url=f"{self.bitbucket_client.base_url}{path}", params=params
        ).prepare()
        self.bitbucket_client.authorize_request(prepared_request=prepared_request)
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

    @responses.activate
    def test_integration_proxy_is_active(self):
        class BitbucketApiProxyTestClient(BitbucketApiClient):
            _use_proxy_url_for_tests = True

            def assert_proxy_request(self, request, is_proxy=True):
                assert (PROXY_BASE_PATH in request.url) == is_proxy
                assert (PROXY_OI_HEADER in request.headers) == is_proxy
                assert (PROXY_SIGNATURE_HEADER in request.headers) == is_proxy
                assert ("Authorization" in request.headers) != is_proxy
                if is_proxy:
                    assert request.headers[PROXY_OI_HEADER] is not None

        api_path = BitbucketAPIPath.repository.format(repo="test-repo")
        bitbucket_responses = responses.add(
            method=responses.GET,
            # Use regex to create responses both from proxy and integration
            url=re.compile(rf"\S+{api_path}$"),
            json={"ok": True},
            status=200,
        )

        expected_proxy_path = f"{api_path}".lstrip("/")

        control_proxy_responses = add_control_silo_proxy_response(
            method=responses.GET, json={"ok": True}, status=200, path=expected_proxy_path
        )

        org_integration = self.install.org_integration
        if not org_integration:
            raise AttributeError("Not associated with an organization")

        with override_settings(SILO_MODE=SiloMode.MONOLITH):

            client = BitbucketApiProxyTestClient(
                integration=self.integration,
                org_integration_id=org_integration.id,
            )
            client.get_repo(repo="test-repo")
            assert bitbucket_responses.call_count == 1
            request = responses.calls[0].request

            assert api_path in request.url
            assert client.base_url in request.url
            client.assert_proxy_request(request, is_proxy=False)

        responses.calls.reset()
        with override_settings(SILO_MODE=SiloMode.CONTROL):
            client = BitbucketApiProxyTestClient(
                integration=self.integration,
                org_integration_id=org_integration.id,
            )
            client.get_repo(repo="test-repo")
            assert bitbucket_responses.call_count == 2
            request = responses.calls[0].request

            assert api_path in request.url
            assert client.base_url in request.url
            client.assert_proxy_request(request, is_proxy=False)

        responses.calls.reset()
        assert control_proxy_responses.call_count == 0
        with override_settings(SILO_MODE=SiloMode.REGION):
            client = BitbucketApiProxyTestClient(
                integration=self.integration,
                org_integration_id=org_integration.id,
            )
            client.get_repo(repo="test-repo")
            assert control_proxy_responses.call_count == 1
            request = responses.calls[0].request

            assert client.base_url not in request.url
            client.assert_proxy_request(request, is_proxy=True)
