from __future__ import annotations

from typing import Any
from unittest import mock

import pytest
import responses
from django.urls import reverse

from sentry.integrations.github import client
from sentry.integrations.github.integration import (
    GitHubInstallationError,
)
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import control_silo_test


@control_silo_test
class GitHubIntegrationApiPipelineTest(APITestCase):
    endpoint = "sentry-api-0-organization-pipeline"
    method = "post"

    base_url = "https://api.github.com"

    def setUp(self) -> None:
        super().setUp()
        self.installation_id = "install_1"
        self.user_id = "user_1"
        self.app_id = "app_1"
        self.access_token = "xxxxx-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        self.expires_at = "3000-01-01T00:00:00Z"
        self.login_as(self.user)
        self._stub_github()

    def tearDown(self) -> None:
        responses.reset()
        super().tearDown()

    @pytest.fixture(autouse=True)
    def stub_get_jwt(self):
        with mock.patch.object(client, "get_jwt", return_value="jwt_token_1"):
            yield

    @pytest.fixture(autouse=True)
    def stub_get_jwt_function(self):
        with mock.patch("sentry.integrations.github.utils.get_jwt", return_value="jwt_token_1"):
            yield

    def _stub_github(self) -> None:
        """Stubs GitHub API responses needed for the integration pipeline."""
        self.gh_org = "Test-Organization"

        responses.add(
            responses.POST,
            "https://github.com/login/oauth/access_token",
            body=f"access_token={self.access_token}",
        )
        responses.add(responses.GET, self.base_url + "/user", json={"login": "octocat"})
        responses.add(
            responses.POST,
            self.base_url + f"/app/installations/{self.installation_id}/access_tokens",
            json={
                "token": self.access_token,
                "expires_at": self.expires_at,
                "permissions": {
                    "administration": "read",
                    "contents": "read",
                    "issues": "write",
                    "metadata": "read",
                    "pull_requests": "read",
                },
                "repository_selection": "all",
            },
        )

        repositories: dict[str, Any] = {
            "xyz": {
                "name": "xyz",
                "full_name": "Test-Organization/xyz",
                "default_branch": "master",
            },
            "foo": {
                "id": 1296269,
                "name": "foo",
                "full_name": "Test-Organization/foo",
                "default_branch": "master",
            },
        }

        responses.add(
            responses.GET,
            url=self.base_url + "/installation/repositories",
            json={
                "total_count": len(repositories),
                "repositories": list(repositories.values()),
            },
        )

        responses.add(
            responses.GET,
            self.base_url + f"/app/installations/{self.installation_id}",
            json={
                "id": self.installation_id,
                "app_id": self.app_id,
                "account": {
                    "id": 60591805,
                    "login": "Test Organization",
                    "avatar_url": "http://example.com/avatar.png",
                    "html_url": "https://github.com/Test-Organization",
                    "type": "Organization",
                },
            },
        )

        responses.add(responses.GET, self.base_url + "/repos/Test-Organization/foo/hooks", json=[])

        responses.add(
            responses.GET,
            f"{self.base_url}/user/memberships/orgs",
            json=[
                {
                    "state": "active",
                    "role": "admin",
                    "organization": {
                        "login": "santry",
                        "id": 1,
                        "avatar_url": "https://example.com/santry.png",
                    },
                },
            ],
        )

    def _get_pipeline_url(self) -> str:
        return reverse(
            self.endpoint,
            args=[self.organization.slug, IntegrationPipeline.pipeline_name],
        )

    def _initialize_pipeline(self) -> Any:
        """POST action=initialize to start the pipeline, return the response."""
        return self.client.post(
            self._get_pipeline_url(),
            data={"action": "initialize", "provider": "github"},
            format="json",
        )

    def _get_step_info(self) -> Any:
        """GET current step info."""
        return self.client.get(self._get_pipeline_url())

    def _advance_step(self, data: dict[str, Any]) -> Any:
        """POST to advance the pipeline with step-specific data."""
        return self.client.post(self._get_pipeline_url(), data=data, format="json")

    def _get_pipeline_signature(self, init_resp: Any) -> str:
        """Extract the pipeline signature (OAuth state) from an initialize response."""
        return init_resp.data["data"]["oauthUrl"].split("state=")[1].split("&")[0]

    def _stub_user_installations(self, installations: list[dict[str, Any]] | None = None) -> None:
        """Stub the GitHub /user/installations endpoint."""
        if installations is None:
            installations = [
                {
                    "id": self.installation_id,
                    "target_type": "Organization",
                    "account": {
                        "login": "santry",
                        "avatar_url": "https://example.com/santry.png",
                    },
                }
            ]
        responses.add(
            responses.GET,
            f"{self.base_url}/user/installations",
            json={"installations": installations},
        )

    def _complete_oauth_step(self, pipeline_signature: str, **extra: Any) -> Any:
        """Submit the OAuth callback data to advance past the OAuth step."""
        return self._advance_step(
            {
                "code": "12345678901234567890",
                "state": pipeline_signature,
                **extra,
            }
        )

    def _advance_to_org_selection(self) -> str:
        """Initialize pipeline and complete OAuth, returning the pipeline signature."""
        resp = self._initialize_pipeline()
        pipeline_signature = self._get_pipeline_signature(resp)
        self._stub_user_installations()

        resp = self._complete_oauth_step(pipeline_signature)
        assert resp.data["status"] == "advance"
        assert resp.data["step"] == "org_selection"
        return pipeline_signature

    @responses.activate
    def test_initialize_pipeline(self) -> None:
        resp = self._initialize_pipeline()
        assert resp.status_code == 200
        assert resp.data["step"] == "oauth_login"
        assert resp.data["stepIndex"] == 0
        assert resp.data["totalSteps"] == 2
        assert resp.data["provider"] == "github"
        assert "oauthUrl" in resp.data["data"]

    @responses.activate
    def test_get_oauth_step_info(self) -> None:
        self._initialize_pipeline()
        resp = self._get_step_info()
        assert resp.status_code == 200
        assert resp.data["step"] == "oauth_login"
        assert "oauthUrl" in resp.data["data"]
        oauth_url = resp.data["data"]["oauthUrl"]
        assert "github.com/login/oauth/authorize" in oauth_url
        assert "client_id=" in oauth_url

    @responses.activate
    def test_oauth_step_advance(self) -> None:
        resp = self._initialize_pipeline()
        pipeline_signature = self._get_pipeline_signature(resp)
        self._stub_user_installations()

        resp = self._complete_oauth_step(pipeline_signature)
        assert resp.status_code == 200
        assert resp.data["status"] == "advance"
        assert resp.data["step"] == "org_selection"
        assert resp.data["stepIndex"] == 1

    @responses.activate
    def test_oauth_step_invalid_state(self) -> None:
        self._initialize_pipeline()
        resp = self._advance_step(
            {
                "code": "12345678901234567890",
                "state": "invalid_state_value",
            }
        )
        assert resp.status_code == 200
        assert resp.data["status"] == "error"
        assert GitHubInstallationError.INVALID_STATE in resp.data["data"]["detail"]

    @responses.activate
    def test_oauth_step_missing_fields(self) -> None:
        self._initialize_pipeline()
        resp = self._advance_step({})
        assert resp.status_code == 200
        assert resp.data["status"] == "stay"
        assert "errors" in resp.data["data"]

    @responses.activate
    def test_org_selection_get_with_installations(self) -> None:
        self._advance_to_org_selection()
        resp = self._get_step_info()
        assert resp.status_code == 200
        assert resp.data["step"] == "org_selection"
        data = resp.data["data"]
        assert "installAppUrl" in data
        assert "installationInfo" in data
        assert len(data["installationInfo"]) > 0

    @responses.activate
    @with_feature("organizations:integrations-scm-multi-org")
    def test_org_selection_choose_existing_installation(self) -> None:
        self._advance_to_org_selection()

        resp = self._advance_step(
            {
                "chosen_installation_id": self.installation_id,
            }
        )
        assert resp.status_code == 200
        assert resp.data["status"] == "complete"

    @responses.activate
    def test_org_selection_new_installation_from_popup(self) -> None:
        """When user installs the app via the GitHub popup, installation_id comes in the POST."""
        self._advance_to_org_selection()

        resp = self._advance_step(
            {
                "installation_id": self.installation_id,
            }
        )
        assert resp.status_code == 200
        assert resp.data["status"] == "complete"

    @responses.activate
    def test_full_api_pipeline_flow_new_installation(self) -> None:
        """End-to-end: initialize -> OAuth -> skip org selection -> complete."""
        resp = self._initialize_pipeline()
        assert resp.status_code == 200
        assert resp.data["step"] == "oauth_login"
        pipeline_signature = self._get_pipeline_signature(resp)

        self._stub_user_installations(installations=[])

        resp = self._complete_oauth_step(pipeline_signature, installation_id=self.installation_id)
        assert resp.status_code == 200
        assert resp.data["status"] == "advance"
        assert resp.data["step"] == "org_selection"

        resp = self._advance_step({"installation_id": self.installation_id})
        assert resp.status_code == 200
        assert resp.data["status"] == "complete"
        assert "data" in resp.data

        integration = Integration.objects.get(provider="github")
        assert integration.external_id == self.installation_id
        assert integration.name == "Test Organization"

        assert OrganizationIntegration.objects.filter(
            organization_id=self.organization.id,
            integration=integration,
        ).exists()

    @responses.activate
    @with_feature("organizations:integrations-scm-multi-org")
    def test_full_api_pipeline_flow_existing_installation(self) -> None:
        """End-to-end: initialize -> OAuth -> choose existing installation -> complete."""
        resp = self._initialize_pipeline()
        pipeline_signature = self._get_pipeline_signature(resp)
        self._stub_user_installations()

        resp = self._complete_oauth_step(pipeline_signature)
        assert resp.data["status"] == "advance"
        assert resp.data["step"] == "org_selection"

        resp = self._advance_step({"chosen_installation_id": self.installation_id})
        assert resp.status_code == 200
        assert resp.data["status"] == "complete"

        integration = Integration.objects.get(provider="github")
        assert integration.external_id == self.installation_id

    @responses.activate
    def test_oauth_exchange_failure(self) -> None:
        """OAuth code exchange fails when GitHub returns no access_token."""
        resp = self._initialize_pipeline()
        pipeline_signature = self._get_pipeline_signature(resp)

        responses.replace(
            responses.POST,
            "https://github.com/login/oauth/access_token",
            body="error=bad_verification_code",
        )

        resp = self._complete_oauth_step(pipeline_signature)
        assert resp.status_code == 200
        assert resp.data["status"] == "error"

    @responses.activate
    def test_org_selection_invalid_installation(self) -> None:
        """Choosing an installation not in the user's list fails validation."""
        self._advance_to_org_selection()

        resp = self._advance_step(
            {
                "chosen_installation_id": "99999",
            }
        )
        assert resp.status_code == 200
        assert resp.data["status"] == "error"
