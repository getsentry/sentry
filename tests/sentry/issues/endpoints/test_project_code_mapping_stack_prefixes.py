from __future__ import annotations

from unittest import mock

from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.projectrepository import ProjectRepository
from sentry.testutils.cases import APITestCase

ENDPOINT_MODULE = "sentry.issues.endpoints.project_code_mapping_stack_prefixes"
SAMPLER_MODULE = "sentry.issues.auto_source_code_config.stack_filename_sample"


class ProjectCodeMappingStackPrefixesGetTest(APITestCase):
    endpoint = "sentry-api-0-project-code-mapping-stack-prefixes"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    @mock.patch(f"{ENDPOINT_MODULE}.sample_in_app_filenames", return_value=[])
    def test_empty_sample_and_no_mappings_returns_empty(self, _mock: mock.MagicMock) -> None:
        response = self.get_success_response(
            self.organization.slug, self.project.slug, status_code=200
        )
        assert response.data == {"prefixes": []}

    @mock.patch(
        f"{ENDPOINT_MODULE}.sample_in_app_filenames",
        return_value=[
            "/usr/src/app/sentry/web/views.py",
            "/usr/src/app/sentry/api/endpoints.py",
            "/usr/src/app/sentry/utils/cache.py",
            "/usr/src/app/static/index.tsx",
            "/usr/src/app/tests/test_utils.py",
        ],
    )
    def test_sampled_paths_produce_ranked_prefixes(self, _mock: mock.MagicMock) -> None:
        response = self.get_success_response(
            self.organization.slug, self.project.slug, status_code=200
        )
        prefixes = {p["path"]: p["fileCount"] for p in response.data["prefixes"]}

        # /usr/src/app/ covers all 5 files
        assert prefixes["/usr/src/app/"] == 5
        assert prefixes["/usr/src/app/sentry/"] == 3
        # filenames and empty catch-all are never returned
        assert "/usr/src/app/sentry/web/views.py" not in prefixes
        assert "" not in prefixes

    @mock.patch(f"{ENDPOINT_MODULE}.sample_in_app_filenames", return_value=[])
    def test_saved_stack_root_included_when_sample_empty(self, _mock: mock.MagicMock) -> None:
        integration = self.create_integration(
            organization=self.organization, provider="github", external_id="1"
        )
        repo = self.create_repo(project=self.project, provider="integrations:github")
        project_repo = ProjectRepository.objects.create(
            project=self.project,
            repository=repo,
        )
        org_integration = integration.organizationintegration_set.first()
        assert org_integration is not None
        RepositoryProjectPathConfig.objects.create(
            project_repository=project_repo,
            organization_integration_id=org_integration.id,
            organization_id=self.organization.id,
            integration_id=integration.id,
            stack_root="src",
            source_root="",
        )

        response = self.get_success_response(
            self.organization.slug, self.project.slug, status_code=200
        )
        prefixes = {p["path"] for p in response.data["prefixes"]}
        assert "src/" in prefixes
