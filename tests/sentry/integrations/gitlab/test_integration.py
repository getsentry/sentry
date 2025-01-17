from dataclasses import asdict
from datetime import datetime, timezone
from unittest.mock import Mock, patch
from urllib.parse import parse_qs, quote, urlencode, urlparse

import orjson
import pytest
import responses
from django.core.cache import cache
from django.test import override_settings

from fixtures.gitlab import GET_COMMIT_RESPONSE, GitLabTestCase
from sentry.integrations.gitlab.blame import GitLabCommitResponse, GitLabFileBlameResponseItem
from sentry.integrations.gitlab.client import GitLabApiClient, GitLabSetupApiClient
from sentry.integrations.gitlab.integration import GitlabIntegration, GitlabIntegrationProvider
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.source_code_management.commit_context import (
    CommitInfo,
    FileBlameInfo,
    SourceLineInfo,
)
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiUnauthorized
from sentry.silo.base import SiloMode
from sentry.silo.util import PROXY_BASE_PATH, PROXY_OI_HEADER, PROXY_SIGNATURE_HEADER
from sentry.testutils.cases import IntegrationTestCase
from sentry.testutils.helpers.integrations import get_installation_of_type
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.users.models.identity import Identity, IdentityProvider, IdentityStatus
from tests.sentry.integrations.test_helpers import add_control_silo_proxy_response


@control_silo_test
class GitlabIntegrationTest(IntegrationTestCase):
    provider = GitlabIntegrationProvider
    config = {
        # Trailing slash is intentional to ensure that valid
        # URLs are generated even if the user inputs a trailing /
        "url": "https://gitlab.example.com/",
        "name": "Test App",
        "group": "cool-group",
        "verify_ssl": True,
        "client_id": "client_id",
        "client_secret": "client_secret",
        "include_subgroups": True,
    }

    default_group_id = 4

    def setUp(self):
        super().setUp()
        self.init_path_without_guide = f"{self.init_path}?completed_installation_guide"

    def assert_setup_flow(self, user_id="user_id_1"):
        resp = self.client.get(self.init_path)
        assert resp.status_code == 200
        self.assertContains(resp, "you will need to create a Sentry app in your GitLab instance")
        resp = self.client.get(self.init_path_without_guide)
        assert resp.status_code == 200
        resp = self.client.post(self.init_path_without_guide, data=self.config)
        assert resp.status_code == 302
        redirect = urlparse(resp["Location"])
        assert redirect.scheme == "https"
        assert redirect.netloc == "gitlab.example.com"
        assert redirect.path == "/oauth/authorize"

        params = parse_qs(redirect.query)
        assert params["state"]
        assert params["redirect_uri"] == ["http://testserver/extensions/gitlab/setup/"]
        assert params["response_type"] == ["code"]
        assert params["client_id"] == ["client_id"]
        # once we've asserted on it, switch to a singular values to make life
        # easier
        authorize_params = {k: v[0] for k, v in params.items()}

        access_token = "xxxxx-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        refresh_token = "rrrrr-rrrrrrrrr-rrrrrrrrrr-rrrrrrrrrrrr"
        responses.add(
            responses.POST,
            "https://gitlab.example.com/oauth/token",
            json={"access_token": access_token, "refresh_token": refresh_token},
        )
        responses.add(responses.GET, "https://gitlab.example.com/api/v4/user", json={"id": user_id})
        responses.add(
            responses.GET,
            "https://gitlab.example.com/api/v4/groups/cool-group",
            json={
                "id": self.default_group_id,
                "full_name": "Cool",
                "full_path": "cool-group",
                "web_url": "https://gitlab.example.com/groups/cool-group",
                "avatar_url": "https://gitlab.example.com/uploads/group/avatar/4/foo.jpg",
            },
        )
        responses.add(
            responses.POST, "https://gitlab.example.com/api/v4/hooks", json={"id": "webhook-id-1"}
        )

        resp = self.client.get(
            "{}?{}".format(
                self.setup_path,
                urlencode({"code": "oauth-code", "state": authorize_params["state"]}),
            )
        )

        mock_access_token_request = responses.calls[0].request
        req_params = parse_qs(mock_access_token_request.body)
        assert req_params["grant_type"] == ["authorization_code"]
        assert req_params["code"] == ["oauth-code"]
        assert req_params["redirect_uri"] == ["http://testserver/extensions/gitlab/setup/"]
        assert req_params["client_id"] == ["client_id"]
        assert req_params["client_secret"] == ["client_secret"]

        assert resp.status_code == 302
        assert (
            resp["Location"]
            == f"http://testserver/settings/{self.organization.slug}/integrations/gitlab/"
        )

    @responses.activate
    @patch("sentry.integrations.gitlab.integration.sha1_text")
    def test_basic_flow(self, mock_sha):
        sha = Mock()
        sha.hexdigest.return_value = "secret-token"
        mock_sha.return_value = sha

        self.assert_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)

        assert integration.external_id == "gitlab.example.com:4"
        assert integration.name == "Cool"
        assert integration.metadata == {
            "instance": "gitlab.example.com",
            "scopes": ["api"],
            "icon": "https://gitlab.example.com/uploads/group/avatar/4/foo.jpg",
            "domain_name": "gitlab.example.com/cool-group",
            "verify_ssl": True,
            "base_url": "https://gitlab.example.com",
            "webhook_secret": "secret-token",
            "group_id": self.default_group_id,
            "include_subgroups": True,
        }
        oi = OrganizationIntegration.objects.get(
            integration=integration, organization_id=self.organization.id
        )
        assert oi.config == {}

        idp = IdentityProvider.objects.get(type="gitlab")
        identity = Identity.objects.get(
            idp=idp, user=self.user, external_id="gitlab.example.com:user_id_1"
        )
        assert identity.status == IdentityStatus.VALID
        assert identity.data == {
            "access_token": "xxxxx-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
            "client_id": "client_id",
            "client_secret": "client_secret",
            "refresh_token": "rrrrr-rrrrrrrrr-rrrrrrrrrr-rrrrrrrrrrrr",
        }

    def test_goback_to_instructions(self):
        # Go to instructions
        resp = self.client.get(self.init_path)
        assert resp.status_code == 200
        self.assertContains(resp, "Step 1")

        # Go to setup form
        resp = self.client.get(self.init_path_without_guide)
        assert resp.status_code == 200
        self.assertContains(resp, "Step 2")

        # Go to back to instructions
        resp = self.client.get(self.init_path + "?goback=1")
        assert resp.status_code == 200
        self.assertContains(resp, "Step 1")

    @responses.activate
    def test_setup_missing_group(self):
        resp = self.client.get(self.init_path_without_guide)
        assert resp.status_code == 200

        resp = self.client.post(self.init_path_without_guide, data=self.config)
        assert resp.status_code == 302

        redirect = urlparse(resp["Location"])
        assert redirect.scheme == "https"
        assert redirect.netloc == "gitlab.example.com"
        assert redirect.path == "/oauth/authorize"

        params = parse_qs(redirect.query)
        authorize_params = {k: v[0] for k, v in params.items()}

        responses.add(
            responses.POST,
            "https://gitlab.example.com/oauth/token",
            json={"access_token": "access-token-value"},
        )

        group_that_does_not_exist = "cool-group"
        responses.add(responses.GET, "https://gitlab.example.com/api/v4/user", json={"id": 9})
        responses.add(
            responses.GET,
            f"https://gitlab.example.com/api/v4/groups/{group_that_does_not_exist}",
            status=404,
        )
        resp = self.client.get(
            "{}?{}".format(
                self.setup_path,
                urlencode({"code": "oauth-code", "state": authorize_params["state"]}),
            )
        )
        assert resp.status_code == 200
        self.assertContains(resp, f"GitLab group {group_that_does_not_exist} could not be found")

    @responses.activate
    def test_get_group_id(self):
        self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)

        installation = get_installation_of_type(
            GitlabIntegration, integration, self.organization.id
        )
        assert self.default_group_id == installation.get_group_id()

    @responses.activate
    def test_get_stacktrace_link(self):
        self.assert_setup_flow()
        external_id = 4
        integration = Integration.objects.get(provider=self.provider.key)
        instance = integration.metadata["instance"]
        with assume_test_silo_mode(SiloMode.REGION):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="Get Sentry / Example Repo",
                external_id=f"{instance}:{external_id}",
                url="https://gitlab.example.com/getsentry/projects/example-repo",
                config={"project_id": external_id, "path": "getsentry/example-repo"},
                provider="integrations:gitlab",
                integration_id=integration.id,
            )
        installation = get_installation_of_type(
            GitlabIntegration, integration, self.organization.id
        )

        filepath = "README.md"
        ref = "master"
        version = "12345678"
        responses.add(
            responses.HEAD,
            f"https://gitlab.example.com/api/v4/projects/{external_id}/repository/files/{filepath}?ref={version}",
        )
        source_url = installation.get_stacktrace_link(repo, "README.md", ref, version)
        assert (
            source_url
            == "https://gitlab.example.com/getsentry/example-repo/blob/12345678/README.md"
        )

    @responses.activate
    def test_get_stacktrace_link_file_doesnt_exist(self):
        self.assert_setup_flow()
        external_id = 4
        integration = Integration.objects.get(provider=self.provider.key)
        instance = integration.metadata["instance"]
        with assume_test_silo_mode(SiloMode.REGION):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="Get Sentry / Example Repo",
                external_id=f"{instance}:{external_id}",
                url="https://gitlab.example.com/getsentry/projects/example-repo",
                config={"project_id": external_id, "path": "getsentry/example-repo"},
                provider="integrations:gitlab",
                integration_id=integration.id,
            )
        installation = get_installation_of_type(
            GitlabIntegration, integration, self.organization.id
        )

        filepath = "README.md"
        ref = "master"
        version = None
        responses.add(
            responses.HEAD,
            f"https://gitlab.example.com/api/v4/projects/{external_id}/repository/files/{filepath}?ref={ref}",
            status=404,
        )
        source_url = installation.get_stacktrace_link(repo, "README.md", ref, version)
        assert not source_url

    @responses.activate
    def test_get_stacktrace_link_file_identity_not_valid(self):
        self.assert_setup_flow()
        external_id = 4
        integration = Integration.objects.get(provider=self.provider.key)
        instance = integration.metadata["instance"]
        with assume_test_silo_mode(SiloMode.REGION):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="Get Sentry / Example Repo",
                external_id=f"{instance}:{external_id}",
                url="https://gitlab.example.com/getsentry/projects/example-repo",
                config={"project_id": external_id, "path": "getsentry/example-repo"},
                provider="integrations:gitlab",
                integration_id=integration.id,
            )
        installation = get_installation_of_type(
            GitlabIntegration, integration, self.organization.id
        )

        filepath = "README.md"
        ref = "master"
        version = None
        responses.add(
            responses.HEAD,
            f"https://gitlab.example.com/api/v4/projects/{external_id}/repository/files/{filepath}?ref={ref}",
            status=401,
        )
        # failed attempt to refresh auth token
        responses.add(
            responses.POST,
            "https://example.gitlab.com/oauth/token",
            status=401,
            json={},
        )

        with pytest.raises(ApiUnauthorized) as excinfo:
            installation.get_stacktrace_link(repo, "README.md", ref, version)
        assert excinfo.value.code == 401

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_halt")
    def test_get_stacktrace_link_use_default_if_version_404(self, mock_record_halt):
        self.assert_setup_flow()
        external_id = 4
        integration = Integration.objects.get(provider=self.provider.key)
        instance = integration.metadata["instance"]
        with assume_test_silo_mode(SiloMode.REGION):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="Get Sentry / Example Repo",
                external_id=f"{instance}:{external_id}",
                url="https://gitlab.example.com/getsentry/projects/example-repo",
                config={"project_id": external_id, "path": "getsentry/example-repo"},
                provider="integrations:gitlab",
                integration_id=integration.id,
            )
        installation = get_installation_of_type(
            GitlabIntegration, integration, self.organization.id
        )

        filepath = "README.md"
        ref = "master"
        version = "12345678"
        responses.add(
            responses.HEAD,
            f"https://gitlab.example.com/api/v4/projects/{external_id}/repository/files/{filepath}?ref={version}",
            status=404,
        )
        responses.add(
            responses.HEAD,
            f"https://gitlab.example.com/api/v4/projects/{external_id}/repository/files/{filepath}?ref={ref}",
        )
        source_url = installation.get_stacktrace_link(repo, "README.md", ref, version)
        assert (
            source_url == "https://gitlab.example.com/getsentry/example-repo/blob/master/README.md"
        )

        mock_record_halt.assert_called_once()

    @responses.activate
    def test_get_commit_context_all_frames(self):
        self.assert_setup_flow()
        external_id = 4
        integration = Integration.objects.get(provider=self.provider.key)
        instance = integration.metadata["instance"]
        with assume_test_silo_mode(SiloMode.REGION):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="Get Sentry / Example Repo",
                external_id=f"{instance}:{external_id}",
                url="https://gitlab.example.com/getsentry/projects/example-repo",
                config={"project_id": external_id, "path": "getsentry/example-repo"},
                provider="integrations:gitlab",
                integration_id=integration.id,
            )
        installation = get_installation_of_type(
            GitlabIntegration, integration, self.organization.id
        )

        file = SourceLineInfo(
            path="src/gitlab.py",
            lineno=10,
            ref="master",
            repo=repo,
            code_mapping=None,  # type: ignore[arg-type]
        )

        responses.add(
            responses.GET,
            url=f"https://gitlab.example.com/api/v4/projects/{external_id}/repository/files/{quote(file.path, safe='')}/blame?ref={file.ref}&range[start]={file.lineno}&range[end]={file.lineno}",
            json=[
                GitLabFileBlameResponseItem(
                    lines=[],
                    commit=GitLabCommitResponse(
                        id="1",
                        message="test message",
                        committed_date="2023-01-01T00:00:00.000Z",
                        author_name="Marvin",
                        author_email="marvin@place.com",
                        committer_email=None,
                        committer_name=None,
                    ),
                )
            ],
            status=200,
        )

        response = installation.get_commit_context_all_frames([file], extra={})

        assert response == [
            FileBlameInfo(
                **asdict(file),
                commit=CommitInfo(
                    commitId="1",
                    commitMessage="test message",
                    committedDate=datetime(2023, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
                    commitAuthorEmail="marvin@place.com",
                    commitAuthorName="Marvin",
                ),
            )
        ]

    @responses.activate
    def test_source_url_matches(self):
        self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)
        installation = get_installation_of_type(
            GitlabIntegration, integration, self.organization.id
        )

        test_cases = [
            (
                "https://gitlab.example.com/cool-group/sentry/blob/master/src/sentry/integrations/github/integration.py",
                True,
            ),
            (
                "https://gitlab.example.com/cool-group/sentry/-/blob/master/src/sentry/integrations/github/integration.py",
                True,
            ),
            (
                "https://notgitlab.com/Test-Organization/sentry/blob/master/src/sentry/integrations/github/integration.py",
                False,
            ),
            ("https://jianyuan.io", False),
        ]
        for source_url, matches in test_cases:
            assert installation.source_url_matches(source_url) == matches

    @responses.activate
    def test_extract_branch_from_source_url(self):
        self.assert_setup_flow()
        external_id = 4
        integration = Integration.objects.get(provider=self.provider.key)
        instance = integration.metadata["instance"]
        with assume_test_silo_mode(SiloMode.REGION):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="Get Sentry / Example Repo",
                external_id=f"{instance}:{external_id}",
                url="https://gitlab.example.com/getsentry/projects/example-repo",
                config={"project_id": external_id, "path": "getsentry/example-repo"},
                provider="integrations:gitlab",
                integration_id=integration.id,
            )
        installation = get_installation_of_type(
            GitlabIntegration, integration, self.organization.id
        )

        test_cases = [
            "https://gitlab.example.com/getsentry/projects/example-repo/blob/master/src/sentry/integrations/github/integration.py",
            "https://gitlab.example.com/getsentry/projects/example-repo/-/blob/master/src/sentry/integrations/github/integration.py",
        ]
        for source_url in test_cases:
            assert installation.extract_branch_from_source_url(repo, source_url) == "master"

    @responses.activate
    def test_extract_source_path_from_source_url(self):
        self.assert_setup_flow()
        external_id = 4
        integration = Integration.objects.get(provider=self.provider.key)
        instance = integration.metadata["instance"]
        with assume_test_silo_mode(SiloMode.REGION):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="Get Sentry / Example Repo",
                external_id=f"{instance}:{external_id}",
                url="https://gitlab.example.com/getsentry/projects/example-repo",
                config={"project_id": external_id, "path": "getsentry/example-repo"},
                provider="integrations:gitlab",
                integration_id=integration.id,
            )
        installation = get_installation_of_type(
            GitlabIntegration, integration, self.organization.id
        )

        test_cases = [
            "https://gitlab.example.com/getsentry/projects/example-repo/blob/master/src/sentry/integrations/github/integration.py",
            "https://gitlab.example.com/getsentry/projects/example-repo/-/blob/master/src/sentry/integrations/github/integration.py",
        ]
        for source_url in test_cases:
            assert (
                installation.extract_source_path_from_source_url(repo, source_url)
                == "src/sentry/integrations/github/integration.py"
            )


@control_silo_test
class GitlabIntegrationInstanceTest(IntegrationTestCase):
    provider = GitlabIntegrationProvider
    config = {
        # Trailing slash is intentional to ensure that valid
        # URLs are generated even if the user inputs a trailing /
        "url": "https://gitlab.example.com/",
        "name": "Test App",
        "group": "",
        "verify_ssl": True,
        "client_id": "client_id",
        "client_secret": "client_secret",
        "include_subgroups": True,
    }

    def setUp(self):
        super().setUp()
        self.init_path_without_guide = f"{self.init_path}?completed_installation_guide"

    def assert_setup_flow(self, user_id="user_id_1"):
        resp = self.client.get(self.init_path)
        assert resp.status_code == 200
        self.assertContains(resp, "you will need to create a Sentry app in your GitLab instance")
        resp = self.client.get(self.init_path_without_guide)
        assert resp.status_code == 200
        resp = self.client.post(self.init_path_without_guide, data=self.config)
        assert resp.status_code == 302
        redirect = urlparse(resp["Location"])
        assert redirect.scheme == "https"
        assert redirect.netloc == "gitlab.example.com"
        assert redirect.path == "/oauth/authorize"

        params = parse_qs(redirect.query)
        assert params["state"]
        assert params["redirect_uri"] == ["http://testserver/extensions/gitlab/setup/"]
        assert params["response_type"] == ["code"]
        assert params["client_id"] == ["client_id"]
        # once we've asserted on it, switch to a singular values to make life easier
        authorize_params = {k: v[0] for k, v in params.items()}

        access_token = "xxxxx-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"

        responses.add(
            responses.POST,
            "https://gitlab.example.com/oauth/token",
            json={"access_token": access_token},
        )
        responses.add(responses.GET, "https://gitlab.example.com/api/v4/user", json={"id": user_id})
        responses.add(
            responses.POST, "https://gitlab.example.com/api/v4/hooks", json={"id": "webhook-id-1"}
        )

        resp = self.client.get(
            "{}?{}".format(
                self.setup_path,
                urlencode({"code": "oauth-code", "state": authorize_params["state"]}),
            )
        )

        mock_access_token_request = responses.calls[0].request
        req_params = parse_qs(mock_access_token_request.body)
        assert req_params["grant_type"] == ["authorization_code"]
        assert req_params["code"] == ["oauth-code"]
        assert req_params["redirect_uri"] == ["http://testserver/extensions/gitlab/setup/"]
        assert req_params["client_id"] == ["client_id"]
        assert req_params["client_secret"] == ["client_secret"]

        assert resp.status_code == 302

        assert (
            resp["Location"]
            == f"http://testserver/settings/{self.organization.slug}/integrations/gitlab/"
        )

    @responses.activate
    @patch("sentry.integrations.gitlab.integration.sha1_text")
    def test_basic_flow(self, mock_sha):
        sha = Mock()
        sha.hexdigest.return_value = "secret-token"
        mock_sha.return_value = sha

        self.assert_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)

        assert integration.external_id == "gitlab.example.com:_instance_"
        assert integration.name == "gitlab.example.com"
        assert integration.metadata == {
            "instance": "gitlab.example.com",
            "scopes": ["api"],
            "icon": None,
            "domain_name": "gitlab.example.com",
            "verify_ssl": True,
            "base_url": "https://gitlab.example.com",
            "webhook_secret": "secret-token",
            "group_id": None,
            "include_subgroups": False,
        }
        oi = OrganizationIntegration.objects.get(
            integration=integration, organization_id=self.organization.id
        )
        assert oi.config == {}

        idp = IdentityProvider.objects.get(type="gitlab")
        identity = Identity.objects.get(
            idp=idp, user=self.user, external_id="gitlab.example.com:user_id_1"
        )
        assert identity.status == IdentityStatus.VALID
        assert identity.data == {
            "access_token": "xxxxx-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
            "client_id": "client_id",
            "client_secret": "client_secret",
        }

    @responses.activate
    def test_get_group_id(self):
        self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)

        installation = get_installation_of_type(
            GitlabIntegration, integration, self.organization.id
        )
        assert installation.get_group_id() is None


def assert_proxy_request(request, is_proxy=True):
    assert (PROXY_BASE_PATH in request.url) == is_proxy
    assert (PROXY_OI_HEADER in request.headers) == is_proxy
    assert (PROXY_SIGNATURE_HEADER in request.headers) == is_proxy
    # The following Gitlab headers don't appear in proxied requests
    assert ("Authorization" in request.headers) != is_proxy
    if is_proxy:
        assert request.headers[PROXY_OI_HEADER] is not None


@override_settings(
    SENTRY_SUBNET_SECRET="hush-hush-im-invisible",
    SENTRY_CONTROL_ADDRESS="http://controlserver",
)
class GitlabSetupApiClientTest(IntegrationTestCase):
    provider = GitlabIntegrationProvider
    base_url = "https://gitlab.example.com"
    access_token = "xxxxx-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
    default_group_id = 4

    @responses.activate
    def test_integration_proxy_is_active(self):
        response_payload = {
            "id": self.default_group_id,
            "full_name": "Cool",
            "full_path": "cool-group",
            "web_url": "https://gitlab.example.com/groups/cool-group",
            "avatar_url": "https://gitlab.example.com/uploads/group/avatar/4/foo.jpg",
        }
        responses.add(
            responses.GET,
            "https://gitlab.example.com/api/v4/groups/cool-group",
            json=response_payload,
        )

        responses.add(
            responses.GET,
            "http://controlserver/api/0/internal/integration-proxy/api/v4/groups/cool-group",
            json=response_payload,
        )

        class GitLabSetupTestClient(GitLabSetupApiClient):
            _use_proxy_url_for_tests = True

        with override_settings(SILO_MODE=SiloMode.MONOLITH):
            client = GitLabSetupTestClient(
                base_url=self.base_url,
                access_token=self.access_token,
                verify_ssl=False,
            )
            client.get_group(group="cool-group")
            request = responses.calls[0].request

            assert "https://gitlab.example.com/api/v4/groups/cool-group" == request.url
            assert client.base_url in request.url
            assert_proxy_request(request, is_proxy=False)

        responses.calls.reset()
        with override_settings(SILO_MODE=SiloMode.CONTROL):
            client = GitLabSetupTestClient(
                base_url=self.base_url,
                access_token=self.access_token,
                verify_ssl=False,
            )
            client.get_group(group="cool-group")
            request = responses.calls[0].request

            assert "https://gitlab.example.com/api/v4/groups/cool-group" == request.url
            assert client.base_url in request.url
            assert_proxy_request(request, is_proxy=False)


@override_settings(
    SENTRY_SUBNET_SECRET="hush-hush-im-invisible",
    SENTRY_CONTROL_ADDRESS="http://controlserver",
)
class GitlabApiClientTest(GitLabTestCase):
    @responses.activate
    def test_integration_proxy_is_active(self):
        gitlab_id = 123
        commit = "a" * 40
        gitlab_response = responses.add(
            method=responses.GET,
            url=f"https://example.gitlab.com/api/v4/projects/{gitlab_id}/repository/commits/{commit}",
            json=orjson.loads(GET_COMMIT_RESPONSE),
        )

        control_proxy_response = add_control_silo_proxy_response(
            method=responses.GET,
            path=f"api/v4/projects/{gitlab_id}/repository/commits/{commit}",
            json=orjson.loads(GET_COMMIT_RESPONSE),
        )

        class GitLabApiTestClient(GitLabApiClient):
            _use_proxy_url_for_tests = True

        with override_settings(SILO_MODE=SiloMode.MONOLITH):
            client = GitLabApiTestClient(self.installation)
            client.get_commit(gitlab_id, commit)
            request = responses.calls[0].request

            assert (
                f"https://example.gitlab.com/api/v4/projects/{gitlab_id}/repository/commits/{commit}"
                == request.url
            )
            assert client.base_url in request.url
            assert gitlab_response.call_count == 1
            assert_proxy_request(request, is_proxy=False)

        responses.calls.reset()
        cache.clear()
        with override_settings(SILO_MODE=SiloMode.CONTROL):
            client = GitLabApiTestClient(self.installation)
            client.get_commit(gitlab_id, commit)
            request = responses.calls[0].request

            assert (
                f"https://example.gitlab.com/api/v4/projects/{gitlab_id}/repository/commits/{commit}"
                == request.url
            )
            assert client.base_url in request.url
            assert gitlab_response.call_count == 2
            assert_proxy_request(request, is_proxy=False)

        responses.calls.reset()
        cache.clear()
        with override_settings(SILO_MODE=SiloMode.REGION):
            client = GitLabApiTestClient(self.installation)
            client.get_commit(gitlab_id, commit)
            request = responses.calls[0].request

            assert control_proxy_response.call_count == 1
            assert client.base_url not in request.url
            assert_proxy_request(request, is_proxy=True)
