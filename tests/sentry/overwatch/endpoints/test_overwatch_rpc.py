import hashlib
import hmac
from copy import deepcopy
from unittest.mock import patch

from django.urls import reverse

from sentry.constants import DEFAULT_CODE_REVIEW_TRIGGERS, DataCategory, ObjectStatus
from sentry.models.organizationcontributors import OrganizationContributors
from sentry.models.repositorysettings import RepositorySettings
from sentry.prevent.models import PreventAIConfiguration
from sentry.prevent.types.config import PREVENT_AI_CONFIG_DEFAULT, PREVENT_AI_CONFIG_DEFAULT_V1
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode

VALID_ORG_CONFIG = {
    "schema_version": "v1",
    "org_defaults": {
        "bug_prediction": {
            "enabled": True,
            "sensitivity": "medium",
            "triggers": {"on_command_phrase": True, "on_ready_for_review": True},
        },
        "test_generation": {
            "enabled": False,
            "triggers": {"on_command_phrase": True, "on_ready_for_review": False},
        },
        "vanilla": {
            "enabled": False,
            "sensitivity": "medium",
            "triggers": {"on_command_phrase": True, "on_ready_for_review": False},
        },
    },
    "repo_overrides": {},
}


class TestPreventPrReviewResolvedConfigsEndpoint(APITestCase):
    def _auth_header_for_get(self, url: str, params: dict[str, str], secret: str) -> str:
        # For GET we sign an empty JSON array body per Rpcsignature rpc0
        message = b"[]"
        signature = hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()
        return f"Rpcsignature rpc0:{signature}"

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_requires_auth(self):
        url = reverse("sentry-api-0-prevent-pr-review-configs-resolved")
        # Missing auth
        resp = self.client.get(url, {"sentryOrgId": "123"})
        assert resp.status_code == 403

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_missing_sentry_org_id_returns_400(self):
        url = reverse("sentry-api-0-prevent-pr-review-configs-resolved")
        auth = self._auth_header_for_get(url, {}, "test-secret")
        resp = self.client.get(url, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 400
        assert "sentryOrgId" in resp.data["detail"]

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_invalid_sentry_org_id_returns_400(self):
        url = reverse("sentry-api-0-prevent-pr-review-configs-resolved")
        params = {"sentryOrgId": "not-a-number", "gitOrgName": "test-org", "provider": "github"}
        auth = self._auth_header_for_get(url, params, "test-secret")
        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 400
        assert "must be a valid integer" in resp.data["detail"]

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_negative_sentry_org_id_returns_400(self):
        url = reverse("sentry-api-0-prevent-pr-review-configs-resolved")
        params = {"sentryOrgId": "-123", "gitOrgName": "test-org", "provider": "github"}
        auth = self._auth_header_for_get(url, params, "test-secret")
        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 400
        assert "must be a positive integer" in resp.data["detail"]

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_missing_git_org_name_returns_400(self):
        url = reverse("sentry-api-0-prevent-pr-review-configs-resolved")
        params = {"sentryOrgId": "123"}
        auth = self._auth_header_for_get(url, params, "test-secret")
        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 400
        assert "gitOrgName" in resp.data["detail"]

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_missing_provider_returns_400(self):
        url = reverse("sentry-api-0-prevent-pr-review-configs-resolved")
        params = {"sentryOrgId": "123", "gitOrgName": "test-org"}
        auth = self._auth_header_for_get(url, params, "test-secret")
        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 400
        assert "provider" in resp.data["detail"]

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_returns_default_when_no_config(self):
        org = self.create_organization()
        git_org_name = "test-github-org"

        with assume_test_silo_mode(SiloMode.CONTROL):
            self.create_integration(
                organization=org,
                provider="github",
                name=git_org_name,
                external_id=f"github:{git_org_name}",
                status=ObjectStatus.ACTIVE,
            )

        url = reverse("sentry-api-0-prevent-pr-review-configs-resolved")
        params = {
            "sentryOrgId": str(org.id),
            "gitOrgName": git_org_name,
            "provider": "github",
        }
        auth = self._auth_header_for_get(url, params, "test-secret")
        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 200
        assert resp.data == PREVENT_AI_CONFIG_DEFAULT
        assert resp.data["organization"] == {}
        # Default config has on_new_commit disabled for bug_prediction
        assert (
            resp.data["default_org_config"]["org_defaults"]["bug_prediction"]["triggers"][
                "on_new_commit"
            ]
            is False
        )

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_returns_v1_default_when_feature_flag_enabled(self):
        org = self.create_organization()
        git_org_name = "test-github-org"

        with assume_test_silo_mode(SiloMode.CONTROL):
            self.create_integration(
                organization=org,
                provider="github",
                name=git_org_name,
                external_id=f"github:{git_org_name}",
                status=ObjectStatus.ACTIVE,
            )

        url = reverse("sentry-api-0-prevent-pr-review-configs-resolved")
        params = {
            "sentryOrgId": str(org.id),
            "gitOrgName": git_org_name,
            "provider": "github",
        }
        auth = self._auth_header_for_get(url, params, "test-secret")

        with self.feature({"organizations:code-review-run-per-commit": org}):
            resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
            assert resp.status_code == 200
            assert resp.data == PREVENT_AI_CONFIG_DEFAULT_V1
            # V1 config has on_new_commit enabled for bug_prediction
            assert (
                resp.data["default_org_config"]["org_defaults"]["bug_prediction"]["triggers"][
                    "on_new_commit"
                ]
                is True
            )
            assert resp.data["organization"] == {}

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_returns_config_when_exists(self):
        org = self.create_organization()
        git_org_name = "test-github-org"

        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=org,
                provider="github",
                name=git_org_name,
                external_id=f"github:{git_org_name}",
                status=ObjectStatus.ACTIVE,
            )

        PreventAIConfiguration.objects.create(
            organization_id=org.id,
            integration_id=integration.id,
            data=VALID_ORG_CONFIG,
        )

        url = reverse("sentry-api-0-prevent-pr-review-configs-resolved")
        params = {
            "sentryOrgId": str(org.id),
            "gitOrgName": git_org_name,
            "provider": "github",
        }
        auth = self._auth_header_for_get(url, params, "test-secret")
        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 200
        assert resp.data["organization"] == VALID_ORG_CONFIG

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_returns_404_when_integration_not_found(self):
        org = self.create_organization()

        url = reverse("sentry-api-0-prevent-pr-review-configs-resolved")
        params = {
            "sentryOrgId": str(org.id),
            "gitOrgName": "nonexistent-org",
            "provider": "github",
        }
        auth = self._auth_header_for_get(url, params, "test-secret")
        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 404
        assert resp.data["detail"] == "GitHub integration not found"

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_config_with_repo_overrides(self):
        org = self.create_organization()
        git_org_name = "test-github-org"

        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=org,
                provider="github",
                name=git_org_name,
                external_id=f"github:{git_org_name}",
                status=ObjectStatus.ACTIVE,
            )

        config_with_overrides = deepcopy(VALID_ORG_CONFIG)
        config_with_overrides["repo_overrides"] = {
            "my-repo": {
                "bug_prediction": {
                    "enabled": True,
                    "sensitivity": "high",
                    "triggers": {"on_command_phrase": True, "on_ready_for_review": False},
                },
                "test_generation": {
                    "enabled": True,
                    "triggers": {"on_command_phrase": True, "on_ready_for_review": True},
                },
                "vanilla": {
                    "enabled": False,
                    "sensitivity": "low",
                    "triggers": {"on_command_phrase": False, "on_ready_for_review": False},
                },
            }
        }

        PreventAIConfiguration.objects.create(
            organization_id=org.id,
            integration_id=integration.id,
            data=config_with_overrides,
        )

        url = reverse("sentry-api-0-prevent-pr-review-configs-resolved")
        params = {
            "sentryOrgId": str(org.id),
            "gitOrgName": git_org_name,
            "provider": "github",
        }
        auth = self._auth_header_for_get(url, params, "test-secret")
        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 200
        assert (
            resp.data["organization"]["repo_overrides"]["my-repo"]["bug_prediction"]["sensitivity"]
            == "high"
        )


class TestPreventPrReviewSentryOrgEndpoint(APITestCase):
    def _auth_header_for_get(self, url: str, params: dict[str, str], secret: str) -> str:
        message = b"[]"
        signature = hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()
        return f"Rpcsignature rpc0:{signature}"

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_requires_auth(self):
        url = reverse("sentry-api-0-prevent-pr-review-github-sentry-org")
        resp = self.client.get(url, {"repoId": "456"})
        assert resp.status_code == 403

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_missing_required_params_returns_400(self):
        url = reverse("sentry-api-0-prevent-pr-review-github-sentry-org")
        auth = self._auth_header_for_get(url, {}, "test-secret")

        resp = self.client.get(url, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 400

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_returns_empty_list_when_no_repos_found(self):
        url = reverse("sentry-api-0-prevent-pr-review-github-sentry-org")
        params = {"repoId": "456"}
        auth = self._auth_header_for_get(url, params, "test-secret")

        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 200
        assert resp.data == {"organizations": []}

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_returns_org_ids_with_consent(self):

        org_with_consent = self.create_organization()
        org_with_consent.update_option("sentry:hide_ai_features", False)
        org_with_consent.update_option("sentry:enable_pr_review_test_generation", True)

        org_without_consent = self.create_organization()
        org_without_consent.update_option("sentry:hide_ai_features", True)

        repo_id = "12345"
        project_with_consent = self.create_project(organization=org_with_consent)
        project_without_consent = self.create_project(organization=org_without_consent)

        self.create_repo(
            project=project_with_consent,
            external_id=repo_id,
            name="org/repo",
            provider="integrations:github",
        )
        self.create_repo(
            project=project_without_consent,
            external_id=repo_id,
            name="org/repo",
            provider="integrations:github",
        )

        url = reverse("sentry-api-0-prevent-pr-review-github-sentry-org")
        params = {"repoId": repo_id}
        auth = self._auth_header_for_get(url, params, "test-secret")

        with self.feature("organizations:gen-ai-features"):
            resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
            assert resp.status_code == 200
            # Should return both orgs with their consent status
            expected_orgs = [
                {
                    "org_id": org_with_consent.id,
                    "org_slug": org_with_consent.slug,
                    "org_name": org_with_consent.name,
                    "has_consent": True,
                },
                {
                    "org_id": org_without_consent.id,
                    "org_slug": org_without_consent.slug,
                    "org_name": org_without_consent.name,
                    "has_consent": False,
                },
            ]
            # Sort both lists by org_id to ensure consistent comparison
            expected_orgs = sorted(expected_orgs, key=lambda x: x["org_id"])
            actual_data = {
                "organizations": sorted(resp.data["organizations"], key=lambda x: x["org_id"])
            }
            assert actual_data == {"organizations": expected_orgs}

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_filters_inactive_repositories(self):
        org = self.create_organization()
        org.update_option("sentry:hide_ai_features", False)
        org.update_option("sentry:enable_pr_review_test_generation", True)

        repo_id = "12345"
        project = self.create_project(organization=org)

        # Note: create_repo doesn't support status parameter, so we need to update it after creation
        repo = self.create_repo(
            project=project,
            external_id=repo_id,
            name="org/repo",
            provider="integrations:github",
        )
        repo.status = ObjectStatus.DISABLED
        repo.save()

        url = reverse("sentry-api-0-prevent-pr-review-github-sentry-org")
        params = {"repoId": repo_id}
        auth = self._auth_header_for_get(url, params, "test-secret")

        with self.feature("organizations:gen-ai-features"):
            resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
            assert resp.status_code == 200
            # Should return empty list as the repository is inactive
            assert resp.data == {"organizations": []}


class TestCodeReviewRepoSettingsEndpoint(APITestCase):
    def _auth_header_for_get(self, url: str, params: dict[str, str], secret: str) -> str:
        message = b"[]"
        signature = hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()
        return f"Rpcsignature rpc0:{signature}"

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_requires_auth(self):
        url = reverse("sentry-api-0-code-review-repo-settings")
        resp = self.client.get(
            url, {"sentryOrgId": "123", "externalRepoId": "456", "provider": "integrations:github"}
        )
        assert resp.status_code == 403

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_missing_sentry_org_id_returns_400(self):
        url = reverse("sentry-api-0-code-review-repo-settings")
        params = {"externalRepoId": "456", "provider": "integrations:github"}
        auth = self._auth_header_for_get(url, params, "test-secret")
        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 400
        assert "sentryOrgId" in resp.data["detail"]

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_invalid_sentry_org_id_returns_400(self):
        url = reverse("sentry-api-0-code-review-repo-settings")
        params = {
            "sentryOrgId": "not-a-number",
            "externalRepoId": "456",
            "provider": "integrations:github",
        }
        auth = self._auth_header_for_get(url, params, "test-secret")
        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 400
        assert "must be a valid integer" in resp.data["detail"]

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_zero_sentry_org_id_returns_400(self):
        url = reverse("sentry-api-0-code-review-repo-settings")
        params = {"sentryOrgId": "0", "externalRepoId": "456", "provider": "integrations:github"}
        auth = self._auth_header_for_get(url, params, "test-secret")
        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 400
        assert "must be a positive integer" in resp.data["detail"]

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_missing_external_repo_id_returns_400(self):
        url = reverse("sentry-api-0-code-review-repo-settings")
        params = {"sentryOrgId": "123", "provider": "integrations:github"}
        auth = self._auth_header_for_get(url, params, "test-secret")
        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 400
        assert "externalRepoId" in resp.data["detail"]

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_missing_provider_returns_400(self):
        url = reverse("sentry-api-0-code-review-repo-settings")
        params = {"sentryOrgId": "123", "externalRepoId": "456"}
        auth = self._auth_header_for_get(url, params, "test-secret")
        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 400
        assert "provider" in resp.data["detail"]

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_returns_defaults_when_no_repo_settings_exist(self):
        org = self.create_organization()
        project = self.create_project(organization=org)
        external_repo_id = "12345"

        self.create_repo(
            project=project,
            external_id=external_repo_id,
            name="org/repo",
            provider="integrations:github",
        )

        url = reverse("sentry-api-0-code-review-repo-settings")
        params = {
            "sentryOrgId": str(org.id),
            "externalRepoId": external_repo_id,
            "provider": "integrations:github",
        }
        auth = self._auth_header_for_get(url, params, "test-secret")
        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 200
        assert resp.data == {"enabledCodeReview": False, "codeReviewTriggers": []}

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_returns_defaults_when_repo_not_found(self):
        org = self.create_organization()

        url = reverse("sentry-api-0-code-review-repo-settings")
        params = {
            "sentryOrgId": str(org.id),
            "externalRepoId": "nonexistent-repo-id",
            "provider": "integrations:github",
        }
        auth = self._auth_header_for_get(url, params, "test-secret")
        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 200
        assert resp.data == {"enabledCodeReview": False, "codeReviewTriggers": []}

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_returns_enabled_with_default_triggers_when_code_review_beta_flag(self):
        org = self.create_organization()

        url = reverse("sentry-api-0-code-review-repo-settings")
        params = {
            "sentryOrgId": str(org.id),
            "externalRepoId": "nonexistent-repo-id",
            "provider": "integrations:github",
        }
        auth = self._auth_header_for_get(url, params, "test-secret")

        with self.feature({"organizations:code-review-beta": org}):
            resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)

        assert resp.status_code == 200
        assert resp.data == {
            "enabledCodeReview": True,
            "codeReviewTriggers": DEFAULT_CODE_REVIEW_TRIGGERS,
        }

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_returns_repo_settings_when_exist(self):
        org = self.create_organization()
        project = self.create_project(organization=org)
        external_repo_id = "12345"

        repo = self.create_repo(
            project=project,
            external_id=external_repo_id,
            name="org/repo",
            provider="integrations:github",
        )

        RepositorySettings.objects.create(
            repository=repo,
            enabled_code_review=True,
            code_review_triggers=["on_command_phrase", "on_ready_for_review"],
        )

        url = reverse("sentry-api-0-code-review-repo-settings")
        params = {
            "sentryOrgId": str(org.id),
            "externalRepoId": external_repo_id,
            "provider": "integrations:github",
        }
        auth = self._auth_header_for_get(url, params, "test-secret")
        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 200
        assert resp.data == {
            "enabledCodeReview": True,
            "codeReviewTriggers": ["on_command_phrase", "on_ready_for_review"],
        }

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_filters_inactive_repositories(self):
        org = self.create_organization()
        project = self.create_project(organization=org)
        external_repo_id = "12345"

        repo = self.create_repo(
            project=project,
            external_id=external_repo_id,
            name="org/repo",
            provider="integrations:github",
        )
        repo.status = ObjectStatus.DISABLED
        repo.save()

        RepositorySettings.objects.create(
            repository=repo,
            enabled_code_review=True,
            code_review_triggers=["on_command_phrase"],
        )

        url = reverse("sentry-api-0-code-review-repo-settings")
        params = {
            "sentryOrgId": str(org.id),
            "externalRepoId": external_repo_id,
            "provider": "integrations:github",
        }
        auth = self._auth_header_for_get(url, params, "test-secret")
        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 200
        # Should return defaults since repository is inactive
        assert resp.data == {"enabledCodeReview": False, "codeReviewTriggers": []}

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_scopes_by_organization(self):
        org1 = self.create_organization()
        org2 = self.create_organization()
        project1 = self.create_project(organization=org1)
        project2 = self.create_project(organization=org2)
        external_repo_id = "12345"

        repo1 = self.create_repo(
            project=project1,
            external_id=external_repo_id,
            name="org/repo",
            provider="integrations:github",
        )
        self.create_repo(
            project=project2,
            external_id=external_repo_id,
            name="org/repo",
            provider="integrations:github",
        )

        # Only create settings for org1's repo
        RepositorySettings.objects.create(
            repository=repo1,
            enabled_code_review=True,
            code_review_triggers=["on_new_commit"],
        )

        url = reverse("sentry-api-0-code-review-repo-settings")

        # Request for org1 should return the settings
        params1 = {
            "sentryOrgId": str(org1.id),
            "externalRepoId": external_repo_id,
            "provider": "integrations:github",
        }
        auth = self._auth_header_for_get(url, params1, "test-secret")
        resp1 = self.client.get(url, params1, HTTP_AUTHORIZATION=auth)
        assert resp1.status_code == 200
        assert resp1.data == {
            "enabledCodeReview": True,
            "codeReviewTriggers": ["on_new_commit"],
        }

        # Request for org2 should return defaults (no settings created)
        params2 = {
            "sentryOrgId": str(org2.id),
            "externalRepoId": external_repo_id,
            "provider": "integrations:github",
        }
        auth = self._auth_header_for_get(url, params2, "test-secret")
        resp2 = self.client.get(url, params2, HTTP_AUTHORIZATION=auth)
        assert resp2.status_code == 200
        assert resp2.data == {
            "enabledCodeReview": False,
            "codeReviewTriggers": ["on_command_phrase"],
        }


class TestPreventPrReviewEligibilityEndpoint(APITestCase):
    def _auth_header_for_get(self, url: str, params: dict[str, str], secret: str) -> str:
        message = b"[]"
        signature = hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()
        return f"Rpcsignature rpc0:{signature}"

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_requires_auth(self):
        url = reverse("sentry-api-0-prevent-pr-review-eligibility")
        resp = self.client.get(url, {"repoId": "456", "prAuthorId": "789"})
        assert resp.status_code == 403

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_missing_repo_id_returns_400(self):
        url = reverse("sentry-api-0-prevent-pr-review-eligibility")
        params = {"prAuthorId": "789"}
        auth = self._auth_header_for_get(url, params, "test-secret")
        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 400
        assert "repoId" in resp.data["detail"]

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_missing_pr_author_id_returns_400(self):
        url = reverse("sentry-api-0-prevent-pr-review-eligibility")
        params = {"repoId": "456"}
        auth = self._auth_header_for_get(url, params, "test-secret")
        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 400
        assert "prAuthorId" in resp.data["detail"]

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_returns_true_for_code_review_beta_org(self):
        org = self.create_organization()
        project = self.create_project(organization=org)
        external_repo_id = "12345"

        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=org,
                provider="github",
                external_id="github:123",
            )

        self.create_repo(
            project=project,
            external_id=external_repo_id,
            name="org/repo",
            provider="integrations:github",
            integration_id=integration.id,
        )

        url = reverse("sentry-api-0-prevent-pr-review-eligibility")
        params = {"repoId": external_repo_id, "prAuthorId": "789"}
        auth = self._auth_header_for_get(url, params, "test-secret")

        with self.feature({"organizations:code-review-beta": org}):
            resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)

        assert resp.status_code == 200
        assert resp.data == {"is_eligible": True}

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_returns_false_when_code_review_not_enabled(self):
        org = self.create_organization()
        project = self.create_project(organization=org)
        external_repo_id = "12345"

        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=org,
                provider="github",
                external_id="github:123",
            )

        self.create_repo(
            project=project,
            external_id=external_repo_id,
            name="org/repo",
            provider="integrations:github",
            integration_id=integration.id,
        )

        url = reverse("sentry-api-0-prevent-pr-review-eligibility")
        params = {"repoId": external_repo_id, "prAuthorId": "789"}
        auth = self._auth_header_for_get(url, params, "test-secret")
        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 200
        assert resp.data == {"is_eligible": False}

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_returns_false_when_code_review_enabled_but_no_contributor_exists(self):
        org = self.create_organization()
        project = self.create_project(organization=org)
        external_repo_id = "12345"
        pr_author_id = "789"

        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=org,
                provider="github",
                external_id="github:123",
            )

        repo = self.create_repo(
            project=project,
            external_id=external_repo_id,
            name="org/repo",
            provider="integrations:github",
            integration_id=integration.id,
        )

        RepositorySettings.objects.create(
            repository=repo,
            enabled_code_review=True,
            code_review_triggers=["on_command_phrase"],
        )

        url = reverse("sentry-api-0-prevent-pr-review-eligibility")
        params = {"repoId": external_repo_id, "prAuthorId": pr_author_id}
        auth = self._auth_header_for_get(url, params, "test-secret")
        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 200
        assert resp.data == {"is_eligible": False}

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    @patch("sentry.overwatch.endpoints.overwatch_rpc.quotas.backend.check_seer_quota")
    def test_returns_false_when_quota_check_fails(self, mock_check_quota):
        mock_check_quota.return_value = False

        org = self.create_organization()
        project = self.create_project(organization=org)
        external_repo_id = "12345"
        pr_author_id = "789"

        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=org,
                provider="github",
                external_id="github:123",
            )

        repo = self.create_repo(
            project=project,
            external_id=external_repo_id,
            name="org/repo",
            provider="integrations:github",
            integration_id=integration.id,
        )

        RepositorySettings.objects.create(
            repository=repo,
            enabled_code_review=True,
            code_review_triggers=["on_command_phrase"],
        )

        OrganizationContributors.objects.create(
            organization=org,
            integration_id=integration.id,
            external_identifier=pr_author_id,
            alias="testuser",
        )

        url = reverse("sentry-api-0-prevent-pr-review-eligibility")
        params = {"repoId": external_repo_id, "prAuthorId": pr_author_id}
        auth = self._auth_header_for_get(url, params, "test-secret")
        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 200
        assert resp.data == {"is_eligible": False}
        mock_check_quota.assert_called_once()

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    @patch("sentry.overwatch.endpoints.overwatch_rpc.quotas.backend.check_seer_quota")
    def test_returns_true_when_code_review_enabled_and_quota_available(self, mock_check_quota):
        mock_check_quota.return_value = True

        org = self.create_organization()
        project = self.create_project(organization=org)
        external_repo_id = "12345"
        pr_author_id = "789"

        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=org,
                provider="github",
                external_id="github:123",
            )

        repo = self.create_repo(
            project=project,
            external_id=external_repo_id,
            name="org/repo",
            provider="integrations:github",
            integration_id=integration.id,
        )

        RepositorySettings.objects.create(
            repository=repo,
            enabled_code_review=True,
            code_review_triggers=["on_command_phrase"],
        )

        contributor = OrganizationContributors.objects.create(
            organization=org,
            integration_id=integration.id,
            external_identifier=pr_author_id,
            alias="testuser",
        )

        url = reverse("sentry-api-0-prevent-pr-review-eligibility")
        params = {"repoId": external_repo_id, "prAuthorId": pr_author_id}
        auth = self._auth_header_for_get(url, params, "test-secret")
        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 200
        assert resp.data == {"is_eligible": True}
        mock_check_quota.assert_called_once_with(
            org_id=org.id,
            data_category=DataCategory.SEER_USER,
            seat_object=contributor,
        )

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    @patch("sentry.overwatch.endpoints.overwatch_rpc.quotas.backend.check_seer_quota")
    def test_returns_true_when_any_org_is_eligible(self, mock_check_quota):
        mock_check_quota.return_value = True

        org1 = self.create_organization()
        org2 = self.create_organization()
        project1 = self.create_project(organization=org1)
        project2 = self.create_project(organization=org2)
        external_repo_id = "12345"
        pr_author_id = "789"

        with assume_test_silo_mode(SiloMode.CONTROL):
            integration1 = self.create_integration(
                organization=org1,
                provider="github",
                external_id="github:123",
            )
            integration2 = self.create_integration(
                organization=org2,
                provider="github",
                external_id="github:456",
            )

        self.create_repo(
            project=project1,
            external_id=external_repo_id,
            name="org/repo",
            provider="integrations:github",
            integration_id=integration1.id,
        )
        repo2 = self.create_repo(
            project=project2,
            external_id=external_repo_id,
            name="org/repo",
            provider="integrations:github",
            integration_id=integration2.id,
        )

        RepositorySettings.objects.create(
            repository=repo2,
            enabled_code_review=True,
            code_review_triggers=["on_command_phrase"],
        )
        OrganizationContributors.objects.create(
            organization=org2,
            integration_id=integration2.id,
            external_identifier=pr_author_id,
            alias="testuser",
        )

        url = reverse("sentry-api-0-prevent-pr-review-eligibility")
        params = {"repoId": external_repo_id, "prAuthorId": pr_author_id}
        auth = self._auth_header_for_get(url, params, "test-secret")
        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 200
        assert resp.data == {"is_eligible": True}
