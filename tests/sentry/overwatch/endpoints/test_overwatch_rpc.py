import hashlib
import hmac
from unittest.mock import patch

from django.urls import reverse

from sentry.constants import ObjectStatus
from sentry.prevent.types.config import PREVENT_AI_CONFIG_GITHUB_DEFAULT
from sentry.testutils.cases import APITestCase


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
    def test_missing_required_params_returns_400(self):
        url = reverse("sentry-api-0-prevent-pr-review-configs-resolved")
        auth = self._auth_header_for_get(url, {}, "test-secret")
        resp = self.client.get(url, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 400

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_invalid_org_id_not_found(self):
        url = reverse("sentry-api-0-prevent-pr-review-configs-resolved")
        params = {"sentryOrgId": "999999"}
        auth = self._auth_header_for_get(url, params, "test-secret")
        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 400

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_invalid_org_id_non_numeric(self):
        url = reverse("sentry-api-0-prevent-pr-review-configs-resolved")
        params = {"sentryOrgId": "abc"}
        auth = self._auth_header_for_get(url, params, "test-secret")
        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 400

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_success_returns_default_config(self):
        org = self.create_organization()
        url = reverse("sentry-api-0-prevent-pr-review-configs-resolved")
        params = {"sentryOrgId": str(org.id)}
        auth = self._auth_header_for_get(url, params, "test-secret")
        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 200
        assert resp.data == PREVENT_AI_CONFIG_GITHUB_DEFAULT

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        ["test-secret"],
    )
    def test_success_returns_custom_config(self):
        org = self.create_organization()
        custom_config = {
            "schema_version": "v1",
            "default_org_config": {
                "org_defaults": {
                    "bug_prediction": {
                        "enabled": False,
                        "sensitivity": "high",
                        "triggers": {
                            "on_command_phrase": False,
                            "on_ready_for_review": True,
                        },
                    },
                    "test_generation": {
                        "enabled": False,
                        "triggers": {
                            "on_command_phrase": False,
                            "on_ready_for_review": False,
                        },
                    },
                    "vanilla": {
                        "enabled": False,
                        "sensitivity": "medium",
                        "triggers": {
                            "on_command_phrase": False,
                            "on_ready_for_review": False,
                        },
                    },
                },
                "repo_overrides": {},
            },
            "github_organizations": {},
        }
        org.update_option("sentry:prevent_ai_config_github", custom_config)

        url = reverse("sentry-api-0-prevent-pr-review-configs-resolved")
        params = {"sentryOrgId": str(org.id)}
        auth = self._auth_header_for_get(url, params, "test-secret")
        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 200
        assert resp.data == custom_config


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

        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 200
        # Should return empty list as the repository is inactive
        assert resp.data == {"organizations": []}
