import base64
from unittest import mock

import pytest
import responses

from sentry.integrations.github_enterprise.integration import GitHubEnterpriseIntegration
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.cases import TestCase

GITHUB_CODEOWNERS = {
    "filepath": "CODEOWNERS",
    "html_url": "https://github.example.org/Test-Organization/foo/blob/master/CODEOWNERS",
    "raw": "docs/*    @jianyuan   @getsentry/ecosystem\n* @jianyuan\n",
}


class GitHubAppsClientTest(TestCase):
    base_url = "https://github.example.org/api/v3"

    def setUp(self):
        super().setUp()

        patcher_1 = mock.patch(
            "sentry.integrations.github_enterprise.client.get_jwt", return_value="jwt_token_1"
        )
        patcher_1.start()
        self.addCleanup(patcher_1.stop)

        patcher_2 = mock.patch(
            "sentry.integrations.github_enterprise.integration.get_jwt", return_value="jwt_token_1"
        )
        patcher_2.start()
        self.addCleanup(patcher_2.stop)

        integration = self.create_integration(
            organization=self.organization,
            provider="github_enterprise",
            name="Github Test Org",
            external_id="1",
            metadata={
                "access_token": None,
                "expires_at": None,
                "icon": "https://github.example.org/avatar.png",
                "domain_name": "github.example.org/Test-Organization",
                "account_type": "Organization",
                "installation_id": "install_id_1",
                "installation": {
                    "client_id": "client_id",
                    "client_secret": "client_secret",
                    "id": "2",
                    "name": "test-app",
                    "private_key": "private_key",
                    "url": "github.example.org",
                    "webhook_secret": "webhook_secret",
                    "verify_ssl": True,
                },
            },
        )
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="Test-Organization/foo",
            url="https://github.example.org/Test-Organization/foo",
            provider="integrations:github_enterprise",
            external_id=123,
            integration_id=integration.id,
        )
        install = integration.get_installation(organization_id=self.organization.id)
        assert isinstance(install, GitHubEnterpriseIntegration)
        self.install = install
        self.gh_client = self.install.get_client()
        responses.add(
            method=responses.POST,
            url=f"{self.base_url}/app/installations/install_id_1/access_tokens",
            body='{"token": "12345token", "expires_at": "2030-01-01T00:00:00Z"}',
            status=200,
            content_type="application/json",
        )

    @responses.activate
    def test_check_file(self):
        path = "src/sentry/integrations/github/client.py"
        version = "master"
        url = f"{self.base_url}/repos/{self.repo.name}/contents/{path}?ref={version}"

        responses.add(
            method=responses.HEAD,
            url=url,
            json={"text": 200},
        )

        resp = self.gh_client.check_file(self.repo, path, version)
        assert resp.status_code == 200

    @responses.activate
    def test_check_no_file(self):
        path = "src/santry/integrations/github/client.py"
        version = "master"
        url = f"{self.base_url}/repos/{self.repo.name}/contents/{path}?ref={version}"

        responses.add(method=responses.HEAD, url=url, status=404)

        with pytest.raises(ApiError):
            self.gh_client.check_file(self.repo, path, version)
        assert responses.calls[1].response.status_code == 404

    @responses.activate
    def test_get_stacktrace_link(self):
        path = "/src/sentry/integrations/github/client.py"
        version = "master"
        url = f"{self.base_url}/repos/{self.repo.name}/contents/{path.lstrip('/')}?ref={version}"

        responses.add(
            method=responses.HEAD,
            url=url,
            json={"text": 200},
        )

        source_url = self.install.get_stacktrace_link(self.repo, path, "master", version)
        assert (
            source_url
            == "https://github.example.org/Test-Organization/foo/blob/master/src/sentry/integrations/github/client.py"
        )

    @mock.patch(
        "sentry.integrations.github.integration.GitHubIntegration.check_file",
        return_value=GITHUB_CODEOWNERS["html_url"],
    )
    @responses.activate
    def test_get_codeowner_file(self, mock_check_file):
        self.config = self.create_code_mapping(
            repo=self.repo,
            project=self.project,
        )
        url = f"{self.base_url}/repos/{self.repo.name}/contents/CODEOWNERS?ref=master"

        responses.add(
            method=responses.HEAD,
            url=url,
            json={"text": 200},
        )
        responses.add(
            method=responses.GET,
            url=url,
            json={"content": base64.b64encode(GITHUB_CODEOWNERS["raw"].encode()).decode("ascii")},
        )
        result = self.install.get_codeowner_file(
            self.config.repository, ref=self.config.default_branch
        )

        assert result == GITHUB_CODEOWNERS
