from __future__ import annotations

from unittest.mock import MagicMock, patch

from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode


class ProjectStacktraceSourceContextTest(APITestCase):
    endpoint = "sentry-api-0-project-stacktrace-source-context"

    def setUp(self) -> None:
        super().setUp()
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration, self.oi = self.create_provider_integration_for(
                self.organization, self.user, provider="example", name="Example"
            )

        self.repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
        )
        self.repo.integration_id = self.integration.id
        self.repo.provider = "example"
        self.repo.save()

        self.code_mapping = self.create_code_mapping(
            organization_integration=self.oi,
            project=self.project,
            repo=self.repo,
            stack_root="src/",
            source_root="src/",
        )

        self.login_as(self.user)
        self.project.update_option("sentry:scm_source_context_enabled", True)

    def test_feature_flag_required(self) -> None:
        response = self.get_response(
            self.organization.slug,
            self.project.slug,
            qs_params={"file": "src/main.py", "lineNo": "10", "platform": "python"},
        )
        assert response.status_code == 404

    def test_project_option_required(self) -> None:
        self.project.update_option("sentry:scm_source_context_enabled", False)
        with self.feature("organizations:scm-source-context"):
            response = self.get_response(
                self.organization.slug,
                self.project.slug,
                qs_params={"file": "src/main.py", "lineNo": "10", "platform": "python"},
            )
            assert response.status_code == 404

    def test_missing_filepath(self) -> None:
        with self.feature("organizations:scm-source-context"):
            response = self.get_response(
                self.organization.slug,
                self.project.slug,
                qs_params={"lineNo": "10", "platform": "python"},
            )
            assert response.status_code == 400

    def test_missing_lineno(self) -> None:
        with self.feature("organizations:scm-source-context"):
            response = self.get_response(
                self.organization.slug,
                self.project.slug,
                qs_params={"file": "src/main.py", "platform": "python"},
            )
            assert response.status_code == 400

    def test_no_code_mappings(self) -> None:
        self.code_mapping.delete()
        with self.feature("organizations:scm-source-context"):
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                qs_params={"file": "src/main.py", "lineNo": "10", "platform": "python"},
            )
            assert response.data["error"] == "no_code_mappings_for_project"
            assert response.data["context"] == []

    @patch("sentry.integrations.utils.source_context.integration_service")
    def test_successful_fetch(self, mock_service: MagicMock) -> None:
        file_content = "\n".join([f"line{i}" for i in range(1, 20)])

        mock_integration = MagicMock()
        mock_service.get_integration.return_value = mock_integration
        mock_install = MagicMock()
        mock_integration.get_installation.return_value = mock_install
        mock_client = MagicMock()
        mock_install.get_client.return_value = mock_client
        mock_client.get_file.return_value = file_content
        mock_install.get_stacktrace_link.return_value = "https://github.com/file"

        from sentry.integrations.source_code_management.repository import RepositoryIntegration

        mock_install.__class__ = RepositoryIntegration  # type: ignore[assignment]

        with self.feature("organizations:scm-source-context"):
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                qs_params={
                    "file": "src/app/main.py",
                    "lineNo": "10",
                    "platform": "python",
                },
            )
            assert response.data["error"] is None
            assert len(response.data["context"]) == 11
            assert response.data["context"][5] == [10, "line10"]
            assert response.data["sourceUrl"] == "https://github.com/file"

    @patch("sentry.integrations.utils.source_context.integration_service")
    def test_file_not_found(self, mock_service: MagicMock) -> None:
        from sentry.integrations.source_code_management.repository import RepositoryIntegration
        from sentry.shared_integrations.exceptions import ApiError

        mock_integration = MagicMock()
        mock_service.get_integration.return_value = mock_integration
        mock_install = MagicMock()
        mock_integration.get_installation.return_value = mock_install
        mock_install.__class__ = RepositoryIntegration  # type: ignore[assignment]
        mock_client = MagicMock()
        mock_install.get_client.return_value = mock_client
        mock_client.get_file.side_effect = ApiError("Not Found", code=404)

        with self.feature("organizations:scm-source-context"):
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                qs_params={
                    "file": "src/app/main.py",
                    "lineNo": "10",
                    "platform": "python",
                },
            )
            assert response.data["error"] == "file_not_found"
            assert response.data["context"] == []
