from __future__ import annotations

from unittest import mock

from sentry.constants import ObjectStatus
from sentry.models.repository import Repository
from sentry.testutils.cases import APITestCase

ENDPOINT_MODULE = "sentry.issues.endpoints.organization_code_mapping_repo_prefixes"


class OrganizationCodeMappingRepoPrefixesGetTest(APITestCase):
    endpoint = "sentry-api-0-organization-code-mapping-repo-prefixes"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="GitHub",
            external_id="1",
        )
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="test-org/repo",
            provider="integrations:github",
            external_id="42",
            integration_id=self.integration.id,
        )

    # --- input validation ---

    def test_missing_repository_id_returns_400(self) -> None:
        self.get_error_response(self.organization.slug, status_code=400)

    def test_non_numeric_repository_id_returns_400(self) -> None:
        self.get_error_response(self.organization.slug, repositoryId="abc", status_code=400)

    # --- resource resolution ---

    def test_unknown_repository_id_returns_404(self) -> None:
        self.get_error_response(self.organization.slug, repositoryId=99999, status_code=404)

    def test_inactive_repository_returns_404(self) -> None:
        self.repo.status = ObjectStatus.DISABLED
        self.repo.save()
        self.get_error_response(self.organization.slug, repositoryId=self.repo.id, status_code=404)

    def test_other_orgs_repository_returns_404(self) -> None:
        other_org = self.create_organization()
        other_repo = Repository.objects.create(
            organization_id=other_org.id,
            name="other-org/repo",
            provider="integrations:github",
            external_id="99",
            integration_id=self.integration.id,
        )
        self.get_error_response(self.organization.slug, repositoryId=other_repo.id, status_code=404)

    # --- successful responses ---

    @mock.patch(f"{ENDPOINT_MODULE}._get_repo_prefixes")
    def test_empty_file_list_returns_empty_prefixes(self, mock_get: mock.MagicMock) -> None:
        mock_get.return_value = ([], None)
        response = self.get_success_response(
            self.organization.slug, repositoryId=self.repo.id, status_code=200
        )
        assert response.data == {"prefixes": []}

    @mock.patch(
        "sentry.integrations.source_code_management.repository.RepositoryIntegration.get_repository_default_branch",
        return_value="main",
    )
    @mock.patch(
        "sentry.integrations.source_code_management.repo_trees.RepoTreesIntegration.get_cached_repo_files",
        return_value=[
            "src/sentry/web/views.py",
            "src/sentry/web/middleware.py",
            "src/sentry/api/endpoints.py",
            "src/sentry/utils/cache.py",
            "static/app/index.tsx",
            "static/app/components/button.tsx",
        ],
    )
    def test_ranking_and_trailing_slashes(
        self,
        mock_files: mock.MagicMock,
        mock_branch: mock.MagicMock,
    ) -> None:
        response = self.get_success_response(
            self.organization.slug, repositoryId=self.repo.id, status_code=200
        )
        prefixes = {p["path"]: p["fileCount"] for p in response.data["prefixes"]}

        # src/ covers 4 files; static/ covers 2
        assert prefixes["src/"] == 4
        assert prefixes["static/"] == 2
        # deeper prefixes have correct counts
        assert prefixes["src/sentry/"] == 4
        assert prefixes["src/sentry/web/"] == 2
        assert prefixes["static/app/"] == 2
        assert prefixes["src/sentry/api/"] == 1
        assert prefixes["src/sentry/utils/"] == 1
        # filenames and empty catch-all are never returned
        assert "src/sentry/web/views.py" not in prefixes
        assert "" not in prefixes

    @mock.patch(
        "sentry.integrations.source_code_management.repository.RepositoryIntegration.get_repository_default_branch",
        return_value="main",
    )
    @mock.patch(
        "sentry.integrations.source_code_management.repo_trees.RepoTreesIntegration.get_cached_repo_files",
        return_value=[
            "src/sentry/web/views.py",
            "src/sentry/api/endpoints.py",
            "src/sentry/utils/cache.py",
            "static/app/index.tsx",
            "tests/sentry/test_utils.py",
        ],
    )
    def test_only_fetches_this_repos_files(
        self,
        mock_files: mock.MagicMock,
        mock_branch: mock.MagicMock,
    ) -> None:
        # A second repo in the same org should not be touched.
        Repository.objects.create(
            organization_id=self.organization.id,
            name="test-org/other",
            provider="integrations:github",
            external_id="43",
            integration_id=self.integration.id,
        )
        self.get_success_response(
            self.organization.slug, repositoryId=self.repo.id, status_code=200
        )
        # get_cached_repo_files was called exactly once (for this repo only)
        mock_files.assert_called_once()
