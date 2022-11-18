from unittest.mock import patch

from django.urls import reverse

from sentry.models.integrations.integration import Integration
from sentry.models.integrations.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.repository import Repository
from sentry.testutils import APITestCase
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.testutils.silo import region_silo_test


@region_silo_test
@apply_feature_flag_on_cls("organizations:derive-code-mappings")
class OrganizationDeriveCodeMappingsTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.project = self.create_project(organization=self.organization)
        self.url = reverse(
            "sentry-api-0-organization-derive-code-mappings",
            args=[self.organization.slug],
        )

        self.repo = self.create_repo(
            name="getsentry/sentry",
            provider="integrations:github",
            integration_id=self.integration.id,
            project=self.project,
        )

    @patch("sentry.integrations.github.GitHubIntegration.get_trees_for_org")
    def test_get_single_match(self, mock_get_trees_for_org):
        config_data = {
            "stacktraceFilename": "/stack/root/file.py",
        }
        expected_matches = [
            {
                "filename": "stack/root/file.py",
                "repo_name": "getsentry/codemap",
                "repo_branch": "master",
                "stacktrace_root": "/stack/root",
                "source_path": "/source/root/",
            }
        ]
        with patch(
            "sentry.integrations.utils.code_mapping.CodeMappingTreesHelper.list_file_matches",
            return_value=expected_matches,
        ):
            response = self.client.get(self.url, data=config_data, format="json")
            assert mock_get_trees_for_org.call_count == 1
            assert response.status_code == 200, response.content
            assert response.data == expected_matches

    @patch("sentry.integrations.github.GitHubIntegration.get_trees_for_org")
    def test_get_multiple_matches(self, mock_get_trees_for_org):
        config_data = {
            "stacktraceFilename": "/stack/root/file.py",
        }
        expected_matches = [
            {
                "filename": "stack/root/file.py",
                "repo_name": "getsentry/codemap",
                "repo_branch": "master",
                "stacktrace_root": "/stack/root",
                "source_path": "/source/root/",
            },
            {
                "filename": "stack/root/file.py",
                "repo_name": "getsentry/codemap",
                "repo_branch": "master",
                "stacktrace_root": "/stack/root",
                "source_path": "/source/root/",
            },
        ]
        with patch(
            "sentry.integrations.utils.code_mapping.CodeMappingTreesHelper.list_file_matches",
            return_value=expected_matches,
        ):
            response = self.client.get(self.url, data=config_data, format="json")
            assert mock_get_trees_for_org.call_count == 1
            assert response.status_code == 200, response.content
            assert response.data == expected_matches

    def test_get_no_installation(self):
        config_data = {
            "projectId": self.project.id,
            "stacktraceFilename": "/stack/root/file.py",
        }
        Integration.objects.all().delete()
        response = self.client.get(self.url, data=config_data, format="json")
        assert response.status_code == 404, response.content

    def test_post_simple(self):
        config_data = {
            "projectId": self.project.id,
            "stackRoot": "/stack/root",
            "sourceRoot": "/source/root",
            "defaultBranch": "master",
            "repoName": "getsentry/codemap",
        }
        response = self.client.post(self.url, data=config_data, format="json")
        repo = Repository.objects.get(name="getsentry/codemap")
        assert response.status_code == 201, response.content
        assert response.data == {
            "id": str(response.data["id"]),
            "projectId": str(self.project.id),
            "projectSlug": self.project.slug,
            "repoId": str(repo.id),
            "repoName": "getsentry/codemap",
            "provider": {
                "aspects": {},
                "features": ["codeowners", "commits", "issue-basic", "stacktrace-link"],
                "name": "GitHub",
                "canDisable": False,
                "key": "github",
                "slug": "github",
                "canAdd": True,
            },
            "integrationId": str(self.integration.id),
            "stackRoot": "/stack/root",
            "sourceRoot": "/source/root",
            "defaultBranch": "master",
        }

    def test_post_no_installation(self):
        config_data = {
            "projectId": self.project.id,
            "stackRoot": "/stack/root",
            "sourceRoot": "/source/root",
            "defaultBranch": "master",
            "repoName": "name",
        }
        Integration.objects.all().delete()
        response = self.client.post(self.url, data=config_data, format="json")
        assert response.status_code == 404, response.content

    def test_post_existing_code_mapping(self):
        RepositoryProjectPathConfig.objects.create(
            project=self.project,
            stack_root="/stack/root",
            source_root="/source/root/wrong",
            default_branch="master",
            repository=self.repo,
            organization_integration=self.organization_integration,
        )

        config_data = {
            "projectId": self.project.id,
            "stackRoot": "/stack/root",
            "sourceRoot": "/source/root",
            "defaultBranch": "master",
            "repoName": "name",
        }
        response = self.client.post(self.url, data=config_data, format="json")
        assert response.status_code == 201, response.content

        new_code_mapping = RepositoryProjectPathConfig.objects.get(
            project=self.project, stack_root="/stack/root"
        )
        assert new_code_mapping.source_root == "/source/root"
