import base64
import hashlib
import hmac
from unittest.mock import patch

from django.urls import reverse

from sentry.constants import ObjectStatus
from sentry.testutils.cases import APITestCase


class TestPreventPrReviewResolvedConfigsEndpoint(APITestCase):
    def _auth_header_for_get(self, url: str, params: dict[str, str], b64_secret: str) -> str:
        secret_bytes = base64.b64decode(b64_secret)
        # For GET we sign an empty JSON array body per Rpcsignature rpc0
        message = b"[]"
        signature = hmac.new(secret_bytes, message, hashlib.sha256).hexdigest()
        return f"Rpcsignature rpc0:{signature}"

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        [base64.b64encode(b"test-secret").decode()],
    )
    def test_requires_auth(self):
        url = reverse("sentry-api-0-prevent-pr-review-configs-resolved")
        # Missing auth
        resp = self.client.get(url, {"ghOrg": "acme", "repo": "acme/repo"})
        assert resp.status_code == 403

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        [base64.b64encode(b"test-secret").decode()],
    )
    def test_missing_required_params_returns_400(self):
        url = reverse("sentry-api-0-prevent-pr-review-configs-resolved")
        b64_secret = base64.b64encode(b"test-secret").decode()
        auth = self._auth_header_for_get(url, {}, b64_secret)
        resp = self.client.get(url, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 400

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        [base64.b64encode(b"test-secret").decode()],
    )
    def test_success_returns_empty_config_dict(self):
        url = reverse("sentry-api-0-prevent-pr-review-configs-resolved")
        params = {"ghOrg": "acme", "repo": "acme/repo"}
        b64_secret = base64.b64encode(b"test-secret").decode()
        auth = self._auth_header_for_get(url, params, b64_secret)
        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 200
        assert resp.data == {}
        assert "Link" not in resp


class TestPreventPrReviewSentryOrgEndpoint(APITestCase):
    def _auth_header_for_get(self, url: str, params: dict[str, str], b64_secret: str) -> str:
        secret_bytes = base64.b64decode(b64_secret)
        message = b"[]"
        signature = hmac.new(secret_bytes, message, hashlib.sha256).hexdigest()
        return f"Rpcsignature rpc0:{signature}"

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        [base64.b64encode(b"test-secret").decode()],
    )
    def test_requires_auth(self):
        url = reverse("sentry-api-0-prevent-pr-review-github-sentry-org")
        resp = self.client.get(url, {"repoId": "456"})
        assert resp.status_code == 403

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        [base64.b64encode(b"test-secret").decode()],
    )
    def test_missing_required_params_returns_400(self):
        url = reverse("sentry-api-0-prevent-pr-review-github-sentry-org")
        b64_secret = base64.b64encode(b"test-secret").decode()
        auth = self._auth_header_for_get(url, {}, b64_secret)

        resp = self.client.get(url, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 400

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        [base64.b64encode(b"test-secret").decode()],
    )
    def test_returns_empty_list_when_no_repos_found(self):
        url = reverse("sentry-api-0-prevent-pr-review-github-sentry-org")
        params = {"repoId": "456"}
        b64_secret = base64.b64encode(b"test-secret").decode()
        auth = self._auth_header_for_get(url, params, b64_secret)

        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 200
        assert resp.data == {"organizations": []}

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        [base64.b64encode(b"test-secret").decode()],
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
        b64_secret = base64.b64encode(b"test-secret").decode()
        auth = self._auth_header_for_get(url, params, b64_secret)

        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 200
        # Should return both orgs with their consent status
        expected_orgs = [
            {"org_id": org_with_consent.id, "has_consent": True},
            {"org_id": org_without_consent.id, "has_consent": False},
        ]
        # Sort both lists by org_id to ensure consistent comparison
        expected_orgs = sorted(expected_orgs, key=lambda x: x["org_id"])
        actual_data = {
            "organizations": sorted(resp.data["organizations"], key=lambda x: x["org_id"])
        }
        assert actual_data == {"organizations": expected_orgs}

    @patch(
        "sentry.overwatch.endpoints.overwatch_rpc.settings.OVERWATCH_RPC_SHARED_SECRET",
        [base64.b64encode(b"test-secret").decode()],
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
        b64_secret = base64.b64encode(b"test-secret").decode()
        auth = self._auth_header_for_get(url, params, b64_secret)

        resp = self.client.get(url, params, HTTP_AUTHORIZATION=auth)
        assert resp.status_code == 200
        # Should return empty list as the repository is inactive
        assert resp.data == {"organizations": []}
