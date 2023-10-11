from time import time
from unittest import mock
from unittest.mock import call
from urllib.parse import parse_qs, quote_plus

import pytest
import responses
from django.test import override_settings
from responses import matchers

from fixtures.vsts import VstsIntegrationTestCase
from sentry.integrations.vsts.client import VstsApiClient
from sentry.integrations.vsts.integration import VstsIntegrationProvider
from sentry.models.identity import Identity, IdentityProvider
from sentry.models.integrations.integration import Integration
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.silo.util import PROXY_BASE_PATH, PROXY_OI_HEADER, PROXY_SIGNATURE_HEADER
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.utils import json


@control_silo_test(stable=True)
class VstsApiClientTest(VstsIntegrationTestCase):
    @pytest.fixture(autouse=True)
    def _setup_metric_patch(self):
        with mock.patch("sentry.shared_integrations.track_response.metrics") as self.metrics:
            yield

    def test_refreshes_expired_token(self):
        self.assert_installation()
        integration = Integration.objects.get(provider="vsts")

        # Make the Identity have an expired token
        idp = IdentityProvider.objects.get(external_id=self.vsts_account_id)
        identity = Identity.objects.get(idp_id=idp.id)
        identity.data["expires"] = int(time()) - int(123456789)
        identity.save()

        # New values VSTS will return on refresh
        self.access_token = "new-access-token"
        self.refresh_token = "new-refresh-token"
        self._stub_vsts()

        # Make a request with expired token
        integration.get_installation(
            integration.organizationintegration_set.first().organization_id
        ).get_client(base_url=self.vsts_base_url).get_projects()

        # Second to last request, before the Projects request, was to refresh
        # the Access Token.
        assert responses.calls[-2].request.url == "https://app.vssps.visualstudio.com/oauth2/token"

        # Then we request the Projects with the new token
        assert (
            responses.calls[-1].request.url.split("?")[0]
            == f"{self.vsts_base_url.lower()}_apis/projects"
        )

        identity = Identity.objects.get(id=identity.id)
        assert identity.scopes == [
            "vso.code",
            "vso.graph",
            "vso.serviceendpoint_manage",
            "vso.work_write",
        ]
        assert identity.data["access_token"] == "new-access-token"
        assert identity.data["refresh_token"] == "new-refresh-token"
        assert identity.data["expires"] > int(time())

    @responses.activate
    def test_does_not_refresh_valid_tokens(self):
        self.assert_installation()
        responses.reset()
        integration = Integration.objects.get(provider="vsts")

        # Make the Identity have a non-expired token
        idp = IdentityProvider.objects.get(external_id=self.vsts_account_id)
        identity = Identity.objects.get(idp_id=idp.id)
        expires = int(time()) + int(123456789)
        identity.data["expires"] = expires
        access_token = identity.data["access_token"]
        refresh_token = identity.data["refresh_token"]
        identity.save()

        # New values VSTS will return on refresh
        self.access_token = "new-access-token"
        self.refresh_token = "new-refresh-token"
        self._stub_vsts()

        # Make a request

        integration.get_installation(
            integration.organizationintegration_set.first().organization_id
        ).get_client(base_url=self.vsts_base_url).get_projects()
        assert len(responses.calls) == 1
        assert (
            responses.calls[0].request.url
            == "https://myvstsaccount.visualstudio.com/_apis/projects?stateFilter=WellFormed&%24skip=0&%24top=100"
        )
        assert identity.data["access_token"] == access_token != self.access_token
        assert identity.data["refresh_token"] == refresh_token != self.refresh_token
        assert identity.data["expires"] == expires

    def test_project_pagination(self):
        def request_callback(request):
            query = parse_qs(request.url.split("?")[1])
            # allow for 220 responses
            if int(query["$skip"][0]) >= 200:
                projects = [self.project_a, self.project_b] * 10
            else:
                projects = [self.project_a, self.project_b] * 50
            resp_body = {"value": projects, "count": len(projects)}
            return (200, {}, json.dumps(resp_body))

        self.assert_installation()
        responses.reset()

        integration = Integration.objects.get(provider="vsts")
        responses.add_callback(
            responses.GET,
            f"https://{self.vsts_account_name.lower()}.visualstudio.com/_apis/projects",
            callback=request_callback,
        )

        projects = (
            integration.get_installation(
                integration.organizationintegration_set.first().organization_id
            )
            .get_client(base_url=self.vsts_base_url)
            .get_projects()
        )
        assert len(projects) == 220

    @responses.activate
    def test_simple(self):
        responses.add(
            responses.GET,
            "https://myvstsaccount.visualstudio.com/_apis/git/repositories/albertos-apples/commits",
            body=b"{}",
            match=[matchers.query_param_matcher({"commit": "b", "$top": "10"})],
        )

        self.assert_installation()
        integration = Integration.objects.get(provider="vsts")
        with assume_test_silo_mode(SiloMode.REGION):
            repo = Repository.objects.create(
                provider="visualstudio",
                name="example",
                organization_id=self.organization.id,
                config={
                    "instance": self.vsts_base_url,
                    "project": "project-name",
                    "name": "example",
                },
                integration_id=integration.id,
                external_id="albertos-apples",
            )

        client = integration.get_installation(
            integration.organizationintegration_set.first().organization_id
        ).get_client(base_url=self.vsts_base_url)

        responses.calls.reset()
        client.get_commits(repo_id=repo.external_id, commit="b", limit=10)

        assert len(responses.calls) == 1

        # Check if metrics is generated properly
        calls = [
            call(
                "integrations.http_response",
                sample_rate=1.0,
                tags={"integration": "vsts", "status": 200},
            ),
            call(
                "integrations.http_response",
                sample_rate=1.0,
                tags={"integration": "vsts", "status": 200},
            ),
            call(
                "integrations.http_response",
                sample_rate=1.0,
                tags={"integration": "vsts", "status": 200},
            ),
            call(
                "integrations.http_response",
                sample_rate=1.0,
                tags={"integration": "vsts", "status": 200},
            ),
            call(
                "integrations.http_response",
                sample_rate=1.0,
                tags={"integration": "vsts", "status": 200},
            ),
        ]
        assert self.metrics.incr.mock_calls == calls

    @responses.activate
    def test_check_file(self):
        self.assert_installation()
        integration = Integration.objects.get(provider="vsts")
        with assume_test_silo_mode(SiloMode.REGION):
            repo = Repository.objects.create(
                provider="visualstudio",
                name="example",
                organization_id=self.organization.id,
                config={
                    "instance": self.vsts_base_url,
                    "project": "project-name",
                    "name": "example",
                },
                integration_id=integration.id,
                external_id="albertos-apples",
            )

        client = integration.get_installation(
            integration.organizationintegration_set.first().organization_id
        ).get_client(base_url=self.vsts_base_url)

        path = "src/sentry/integrations/vsts/client.py"
        version = "master"
        url = f"https://myvstsaccount.visualstudio.com/project-name/_apis/git/repositories/{repo.name}/items?path={path}&api-version=7.0&versionDescriptor.version={version}"

        responses.add(
            method=responses.GET,
            url=url,
            json={"text": 200},
        )

        resp = client.check_file(repo, path, version)
        assert resp.status_code == 200

    @responses.activate
    def test_check_no_file(self):
        self.assert_installation()
        integration = Integration.objects.get(provider="vsts")
        with assume_test_silo_mode(SiloMode.REGION):
            repo = Repository.objects.create(
                provider="visualstudio",
                name="example",
                organization_id=self.organization.id,
                config={
                    "instance": self.vsts_base_url,
                    "project": "project-name",
                    "name": "example",
                },
                integration_id=integration.id,
                external_id="albertos-apples",
            )

        client = integration.get_installation(
            integration.organizationintegration_set.first().organization_id
        ).get_client(base_url=self.vsts_base_url)

        path = "src/sentry/integrations/vsts/client.py"
        version = "master"
        url = f"https://myvstsaccount.visualstudio.com/project-name/_apis/git/repositories/{repo.name}/items?path={path}&api-version=7.0&versionDescriptor.version={version}"

        responses.add(method=responses.HEAD, url=url, status=404)

        with pytest.raises(ApiError):
            client.check_file(repo, path, version)

    @responses.activate
    def test_get_stacktrace_link(self):
        self.assert_installation()
        integration = Integration.objects.get(provider="vsts")
        installation = integration.get_installation(
            integration.organizationintegration_set.first().organization_id
        )
        with assume_test_silo_mode(SiloMode.REGION):
            repo = Repository.objects.create(
                provider="visualstudio",
                name="example",
                organization_id=self.organization.id,
                config={
                    "instance": self.vsts_base_url,
                    "project": "project-name",
                    "name": "example",
                },
                integration_id=integration.id,
                external_id="albertos-apples",
            )

        path = "/src/sentry/integrations/vsts/client.py"
        version = "master"
        url = f"https://myvstsaccount.visualstudio.com/project-name/_apis/git/repositories/{repo.name}/items?path={path.lstrip('/')}&api-version=7.0&versionDescriptor.version={version}"

        responses.add(
            method=responses.GET,
            url=url,
            json={"text": 200},
        )

        source_url = installation.get_stacktrace_link(repo, path, "master", version)
        assert (
            source_url
            == f"https://MyVSTSAccount.visualstudio.com/project-name/_git/{repo.name}?path={quote_plus(path)}&version=GB{version}"
        )


def assert_proxy_request(request, is_proxy=True):
    assert (PROXY_BASE_PATH in request.url) == is_proxy
    assert (PROXY_OI_HEADER in request.headers) == is_proxy
    assert (PROXY_SIGNATURE_HEADER in request.headers) == is_proxy
    assert ("Authorization" in request.headers) != is_proxy
    if is_proxy:
        assert request.headers[PROXY_OI_HEADER] is not None


@override_settings(
    SENTRY_SUBNET_SECRET="hush-hush-im-invisible",
    SENTRY_CONTROL_ADDRESS="http://controlserver",
)
class VstsProxyApiClientTest(VstsIntegrationTestCase):
    @responses.activate
    def test_integration_proxy_is_active(self):
        responses.add(
            responses.GET,
            "https://myvstsaccount.visualstudio.com/_apis/git/repositories/albertos-apples/commits",
            body=b"{}",
            match=[
                matchers.query_param_matcher(
                    {"commit": "b", "$top": "10"},
                ),
                matchers.header_matcher(
                    {
                        "Accept": "application/json; api-version=4.1",
                        "Content-Type": "application/json",
                        "X-HTTP-Method-Override": "GET",
                        "X-TFS-FedAuthRedirect": "Suppress",
                        "Authorization": f"Bearer {self.access_token}",
                    }
                ),
            ],
        )
        responses.add(
            responses.GET,
            "http://controlserver/api/0/internal/integration-proxy/_apis/git/repositories/albertos-apples/commits",
            body=b"{}",
            match=[
                matchers.query_param_matcher({"commit": "b", "$top": "10"}),
                matchers.header_matcher(
                    {
                        "Accept": "application/json; api-version=4.1",
                        "Content-Type": "application/json",
                        "X-HTTP-Method-Override": "GET",
                        "X-TFS-FedAuthRedirect": "Suppress",
                    }
                ),
            ],
        )
        self.assert_installation()

        integration = Integration.objects.get(provider="vsts")
        installation = integration.get_installation(
            integration.organizationintegration_set.first().organization_id
        )
        repo = Repository.objects.create(
            provider="visualstudio",
            name="example",
            organization_id=self.organization.id,
            config={"instance": self.vsts_base_url, "project": "project-name", "name": "example"},
            integration_id=integration.id,
            external_id="albertos-apples",
        )

        class VstsProxyApiTestClient(VstsApiClient):
            _use_proxy_url_for_tests = True

        responses.calls.reset()
        with override_settings(SILO_MODE=SiloMode.MONOLITH):
            client = VstsProxyApiTestClient(
                base_url=self.vsts_base_url,
                oauth_redirect_url=VstsIntegrationProvider.oauth_redirect_url,
                org_integration_id=installation.org_integration.id,
                identity_id=installation.org_integration.default_auth_id,
            )
            client.get_commits(repo_id=repo.external_id, commit="b", limit=10)

            assert len(responses.calls) == 1
            request = responses.calls[0].request
            assert (
                "https://myvstsaccount.visualstudio.com/_apis/git/repositories/albertos-apples/commits?commit=b&%24top=10"
                == request.url
            )
            assert client.base_url and (client.base_url.lower() in request.url)
            assert_proxy_request(request, is_proxy=False)

        responses.calls.reset()
        with override_settings(SILO_MODE=SiloMode.CONTROL):
            client = VstsProxyApiTestClient(
                base_url=self.vsts_base_url,
                oauth_redirect_url=VstsIntegrationProvider.oauth_redirect_url,
                org_integration_id=installation.org_integration.id,
                identity_id=installation.org_integration.default_auth_id,
            )
            client.get_commits(repo_id=repo.external_id, commit="b", limit=10)

            assert len(responses.calls) == 1
            request = responses.calls[0].request
            assert (
                "https://myvstsaccount.visualstudio.com/_apis/git/repositories/albertos-apples/commits?commit=b&%24top=10"
                == request.url
            )
            assert client.base_url and (client.base_url.lower() in request.url)
            assert_proxy_request(request, is_proxy=False)

        responses.calls.reset()
        with override_settings(SILO_MODE=SiloMode.REGION):
            client = VstsProxyApiTestClient(
                base_url=self.vsts_base_url,
                oauth_redirect_url=VstsIntegrationProvider.oauth_redirect_url,
                org_integration_id=installation.org_integration.id,
                identity_id=installation.org_integration.default_auth_id,
            )
            client.get_commits(repo_id=repo.external_id, commit="b", limit=10)

            assert len(responses.calls) == 1
            request = responses.calls[0].request
            assert (
                "http://controlserver/api/0/internal/integration-proxy/_apis/git/repositories/albertos-apples/commits?commit=b&%24top=10"
                == request.url
            )
            assert client.base_url and (client.base_url.lower() not in request.url)
            assert_proxy_request(request, is_proxy=True)
