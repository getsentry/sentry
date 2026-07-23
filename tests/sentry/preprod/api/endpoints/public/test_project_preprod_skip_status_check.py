from __future__ import annotations

from unittest.mock import Mock, patch

from django.urls import reverse

from sentry.constants import ObjectStatus
from sentry.integrations.errors import OrganizationIntegrationNotFound
from sentry.integrations.source_code_management.status_check import StatusCheckStatus
from sentry.preprod.vcs.status_checks.skip import CONFIGURATION_ERROR_DETAIL
from sentry.preprod.vcs.status_checks.utils import get_status_check_client_for_repo
from sentry.shared_integrations.exceptions import ApiError, ApiRateLimitedError, IntegrationError
from sentry.testutils.cases import APITestCase, TestCase

ENDPOINT_MODULE = "sentry.preprod.api.endpoints.public.project_preprod_skip_status_check"
SKIP_MODULE = "sentry.preprod.vcs.status_checks.skip"


class ProjectPreprodSkipStatusCheckEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-preprod-size-analysis-skip-status-check"
    check_type = "size"
    expected_check_name = "Size Analysis"

    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.repository = self.create_repo(
            project=self.project,
            name="owner/repo",
            provider="integrations:github",
            integration_id=123,
        )
        self.sha = "a" * 40

    def _url(self, organization_slug=None, project_slug=None):
        return reverse(
            self.endpoint,
            args=[organization_slug or self.organization.slug, project_slug or self.project.slug],
        )

    def _post(self, data, scope_list=None, url=None, include_provider=True):
        # project:releases is what CI upload tokens (sentry-cli) carry, so it's the
        # realistic scope for this endpoint (see ProjectReleasePermission).
        token = self.create_user_auth_token(
            self.user, scope_list=scope_list or ["project:releases"]
        )
        payload = {"provider": "github", **data} if include_provider else data
        return self.client.post(
            url or self._url(),
            payload,
            HTTP_AUTHORIZATION=f"Bearer {token.token}",
        )

    def _patch_provider(self, mock_provider):
        return (
            patch(
                f"{SKIP_MODULE}.get_status_check_client_for_repo",
                return_value=(Mock(), self.repository),
            ),
            patch(f"{SKIP_MODULE}.get_status_check_provider", return_value=mock_provider),
        )

    def test_posts_skipped_check(self) -> None:
        mock_provider = Mock()
        mock_provider.create_status_check.return_value = "check_123"

        client_patch, provider_patch = self._patch_provider(mock_provider)
        with (
            client_patch,
            provider_patch,
            patch(f"{ENDPOINT_MODULE}.metrics") as mock_metrics,
            patch(f"{SKIP_MODULE}.logger") as mock_logger,
        ):
            response = self._post({"sha": self.sha, "repository": "owner/repo"})

        assert response.status_code == 200
        assert response.json() == {"checkId": "check_123"}

        mock_provider.create_status_check.assert_called_once()
        kwargs = mock_provider.create_status_check.call_args.kwargs
        assert kwargs["repo"] == "owner/repo"
        assert kwargs["sha"] == self.sha
        assert kwargs["status"] == StatusCheckStatus.NEUTRAL
        # The posted check name must match the required-check name Sentry posts
        # during normal processing, or branch protection won't be satisfied.
        assert kwargs["title"] == self.expected_check_name
        assert kwargs["completed_at"] is not None
        mock_metrics.incr.assert_called_once_with(
            "preprod.status_checks.skip",
            tags={"check_type": self.check_type, "success": True},
        )
        mock_logger.info.assert_called_once()
        log_extra = mock_logger.info.call_args.kwargs["extra"]
        assert log_extra["repository_id"] == self.repository.id
        assert "repo" not in log_extra
        assert "owner/repo" not in log_extra.values()

    def test_missing_sha_returns_400(self) -> None:
        response = self._post({"repository": "owner/repo"})
        assert response.status_code == 400
        assert response.json() == {"sha": ["This field is required."]}

    def test_missing_repository_returns_400(self) -> None:
        response = self._post({"sha": self.sha})
        assert response.status_code == 400
        assert response.json() == {"repository": ["This field is required."]}

    def test_missing_provider_returns_400(self) -> None:
        response = self._post({"sha": self.sha, "repository": "owner/repo"}, include_provider=False)
        assert response.status_code == 400
        assert response.json() == {"provider": ["This field is required."]}

    def test_unsupported_provider_returns_400(self) -> None:
        response = self._post({"sha": self.sha, "repository": "owner/repo", "provider": "gitlab"})
        assert response.status_code == 400
        assert "provider" in response.json()
        assert "gitlab" in response.json()["provider"][0]

    def _assert_invalid_sha(self, sha: str) -> None:
        response = self._post({"sha": sha, "repository": "owner/repo"})

        assert response.status_code == 400
        assert "sha" in response.json()

    def test_rejects_short_sha(self) -> None:
        self._assert_invalid_sha("a" * 39)

    def test_rejects_long_sha(self) -> None:
        self._assert_invalid_sha("a" * 41)

    def test_rejects_uppercase_sha(self) -> None:
        self._assert_invalid_sha("A" * 40)

    def test_rejects_non_hex_sha(self) -> None:
        self._assert_invalid_sha("not-a-sha")

    def test_rejects_oversized_repository(self) -> None:
        response = self._post({"sha": self.sha, "repository": "r" * 256})

        assert response.status_code == 400
        assert "repository" in response.json()

    def test_validation_error_records_metric(self) -> None:
        with patch(f"{ENDPOINT_MODULE}.metrics") as mock_metrics:
            response = self._post({"sha": "invalid", "repository": "owner/repo"})

        assert response.status_code == 400
        mock_metrics.incr.assert_called_once_with(
            "preprod.status_checks.skip",
            tags={
                "check_type": self.check_type,
                "success": False,
                "reason": "validation_error",
            },
        )

    def test_accepts_github_enterprise_provider(self) -> None:
        mock_provider = Mock()
        mock_provider.create_status_check.return_value = "check_123"
        client_patch, provider_patch = self._patch_provider(mock_provider)

        with client_patch as mock_get_client, provider_patch:
            response = self._post(
                {
                    "sha": self.sha,
                    "repository": "owner/repo",
                    "provider": "github_enterprise",
                }
            )

        assert response.status_code == 200
        mock_get_client.assert_called_once_with(self.project, "owner/repo", "github_enterprise")

    def test_repo_not_integrated_returns_400(self) -> None:
        # No patching: the real resolver finds no matching integrated repository.
        response = self._post({"sha": self.sha, "repository": "owner/not-integrated"})
        assert response.status_code == 400
        assert "owner/not-integrated" in response.json()["detail"]

    def test_missing_organization_installation_returns_400(self) -> None:
        with (
            patch(
                f"{SKIP_MODULE}.get_status_check_client_for_repo",
                side_effect=IntegrationError("sensitive provider detail"),
            ),
            patch(f"{ENDPOINT_MODULE}.metrics") as mock_metrics,
            patch(f"{SKIP_MODULE}.logger") as mock_logger,
        ):
            response = self._post({"sha": self.sha, "repository": "owner/repo"})

        assert response.status_code == 400
        assert response.json() == {"detail": CONFIGURATION_ERROR_DETAIL}
        assert "sensitive provider detail" not in response.json()["detail"]
        mock_metrics.incr.assert_called_once_with(
            "preprod.status_checks.skip",
            tags={"check_type": self.check_type, "success": False, "reason": "config_error"},
        )
        assert mock_logger.warning.call_args.args[0] == (
            "preprod.status_checks.skip.configuration_error"
        )
        assert mock_logger.warning.call_args.kwargs["exc_info"] is True
        log_extra = mock_logger.warning.call_args.kwargs["extra"]
        assert "repo" not in log_extra
        assert "owner/repo" not in log_extra.values()

    def test_rate_limit_returns_429(self) -> None:
        mock_provider = Mock()
        mock_provider.create_status_check.side_effect = ApiRateLimitedError("provider detail")
        client_patch, provider_patch = self._patch_provider(mock_provider)

        with client_patch, provider_patch, patch(f"{ENDPOINT_MODULE}.metrics") as mock_metrics:
            response = self._post({"sha": self.sha, "repository": "owner/repo"})

        assert response.status_code == 429
        assert response.json() == {"detail": "GitHub rate limit exceeded, please retry later."}
        mock_metrics.incr.assert_called_once_with(
            "preprod.status_checks.skip",
            tags={"check_type": self.check_type, "success": False, "reason": "rate_limited"},
        )

    def test_upstream_error_returns_502_and_logs(self) -> None:
        mock_provider = Mock()
        mock_provider.create_status_check.side_effect = ApiError("provider detail", code=500)
        client_patch, provider_patch = self._patch_provider(mock_provider)

        with (
            client_patch,
            provider_patch,
            patch(f"{ENDPOINT_MODULE}.metrics") as mock_metrics,
            patch(f"{SKIP_MODULE}.logger") as mock_logger,
        ):
            response = self._post({"sha": self.sha, "repository": "owner/repo"})

        assert response.status_code == 502
        assert response.json() == {"detail": "Failed to post status check to GitHub."}
        mock_metrics.incr.assert_called_once_with(
            "preprod.status_checks.skip",
            tags={"check_type": self.check_type, "success": False, "reason": "upstream_error"},
        )
        assert mock_logger.warning.call_args.args[0] == "preprod.status_checks.skip.api_error"
        log_extra = mock_logger.warning.call_args.kwargs["extra"]
        assert log_extra["repository_id"] == self.repository.id
        assert "repo" not in log_extra
        assert "owner/repo" not in log_extra.values()

    def test_null_check_id_returns_502(self) -> None:
        mock_provider = Mock()
        mock_provider.create_status_check.return_value = None

        client_patch, provider_patch = self._patch_provider(mock_provider)
        with (
            client_patch,
            provider_patch,
            patch(f"{ENDPOINT_MODULE}.metrics") as mock_metrics,
            patch(f"{SKIP_MODULE}.logger") as mock_logger,
        ):
            response = self._post({"sha": self.sha, "repository": "owner/repo"})

        assert response.status_code == 502
        mock_metrics.incr.assert_called_once_with(
            "preprod.status_checks.skip",
            tags={"check_type": self.check_type, "success": False, "reason": "null_check_id"},
        )
        assert mock_logger.warning.call_args.args[0] == "preprod.status_checks.skip.null_check_id"
        log_extra = mock_logger.warning.call_args.kwargs["extra"]
        assert log_extra["repository_id"] == self.repository.id
        assert "repo" not in log_extra
        assert "owner/repo" not in log_extra.values()

    def test_read_only_scope_forbidden(self) -> None:
        response = self._post(
            {"sha": self.sha, "repository": "owner/repo"}, scope_list=["project:read"]
        )
        assert response.status_code == 403


class ProjectPreprodSnapshotSkipStatusCheckEndpointTest(ProjectPreprodSkipStatusCheckEndpointTest):
    endpoint = "sentry-api-0-project-preprod-snapshot-skip-status-check"
    check_type = "snapshots"
    expected_check_name = "Snapshot Testing"


class StatusCheckClientForRepoTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.repository = self.create_repo(
            project=self.project,
            name="owner/repo",
            provider="integrations:github",
            integration_id=123,
        )

    def test_provider_disambiguates_github_and_ghe(self) -> None:
        self.create_repo(
            project=self.project,
            name="owner/repo",
            provider="integrations:github_enterprise",
            integration_id=456,
        )
        client = Mock()

        with patch(
            "sentry.preprod.vcs.status_checks.utils._status_check_client_from_repository",
            return_value=client,
        ):
            resolved_client, repository = get_status_check_client_for_repo(
                self.project, "owner/repo", "github"
            )

        assert resolved_client == client
        assert repository == self.repository

    def test_inactive_repository_is_not_resolved(self) -> None:
        self.repository.update(status=ObjectStatus.PENDING_DELETION)

        with patch(
            "sentry.preprod.vcs.status_checks.utils._status_check_client_from_repository"
        ) as get_client:
            client, repository = get_status_check_client_for_repo(
                self.project, "owner/repo", "github"
            )

        assert client is None
        assert repository is None
        get_client.assert_not_called()

    def test_missing_organization_integration_is_not_resolved(self) -> None:
        installation = Mock()
        installation.get_client.side_effect = OrganizationIntegrationNotFound(
            "missing org_integration"
        )
        integration = Mock()
        integration.get_installation.return_value = installation

        with (
            patch(
                "sentry.preprod.vcs.status_checks.utils.integration_service.get_integration",
                return_value=integration,
            ),
            patch("sentry.preprod.vcs.status_checks.utils.logger") as mock_logger,
        ):
            client, repository = get_status_check_client_for_repo(
                self.project, "owner/repo", "github"
            )

        assert client is None
        assert repository is None
        assert mock_logger.info.call_args.args[0] == (
            "preprod.status_checks.create.no_organization_integration"
        )
        assert mock_logger.info.call_args.kwargs["extra"]["repository"] == self.repository.id

    def test_unresolved_repository_name_is_not_logged(self) -> None:
        with patch("sentry.preprod.vcs.status_checks.utils.logger") as mock_logger:
            client, repository = get_status_check_client_for_repo(
                self.project, "customer/private-repo", "github"
            )

        assert client is None
        assert repository is None
        log_extra = mock_logger.info.call_args.kwargs["extra"]
        assert "repo_name" not in log_extra
        assert "customer/private-repo" not in log_extra.values()
