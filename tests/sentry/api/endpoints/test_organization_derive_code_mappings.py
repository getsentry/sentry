from unittest.mock import patch

from django.db import router
from django.urls import reverse
from rest_framework import status

from sentry.integrations.models.integration import Integration
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.repository import Repository
from sentry.silo.base import SiloMode
from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode


class OrganizationDeriveCodeMappingsTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.organization = self.create_organization("federal-bureau-of-control")
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        self.team = self.create_team(organization=self.organization, name="night-springs")
        self.create_team_membership(team=self.team, user=self.user)
        self.project = self.create_project(organization=self.organization, teams=[self.team])
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

    @patch("sentry.integrations.github.integration.GitHubIntegration.get_trees_for_org")
    def test_get_single_match(self, mock_get_trees_for_org):
        config_data = {
            "stacktraceFilename": "stack/root/file.py",
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

    @patch("sentry.integrations.github.integration.GitHubIntegration.get_trees_for_org")
    def test_get_start_with_backslash(self, mock_get_trees_for_org):
        file = "stack/root/file.py"
        config_data = {"stacktraceFilename": f"/{file}"}
        expected_matches = [
            {
                "filename": file,
                "repo_name": "getsentry/codemap",
                "repo_branch": "master",
                "stacktrace_root": "",
                "source_path": "",
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

    @patch("sentry.integrations.github.integration.GitHubIntegration.get_trees_for_org")
    def test_get_multiple_matches(self, mock_get_trees_for_org):
        config_data = {
            "stacktraceFilename": "stack/root/file.py",
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
            "stacktraceFilename": "stack/root/file.py",
        }
        with (
            assume_test_silo_mode(SiloMode.CONTROL),
            unguarded_write(using=router.db_for_write(Integration)),
        ):
            Integration.objects.all().delete()
        response = self.client.get(self.url, data=config_data, format="json")
        assert response.status_code == 404, response.content

    def test_non_project_member_permissions(self):
        config_data = {
            "projectId": self.project.id,
            "stackRoot": "/stack/root",
            "sourceRoot": "/source/root",
            "defaultBranch": "master",
            "repoName": "getsentry/codemap",
        }
        non_member = self.create_user()
        non_member_om = self.create_member(organization=self.organization, user=non_member)
        self.login_as(user=non_member)

        response = self.client.post(self.url, data=config_data, format="json")
        assert response.status_code == status.HTTP_403_FORBIDDEN

        self.create_team_membership(team=self.team, member=non_member_om)

        response = self.client.post(self.url, data=config_data, format="json")
        assert response.status_code == status.HTTP_201_CREATED

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
            "automaticallyGenerated": True,
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
        with (
            assume_test_silo_mode(SiloMode.CONTROL),
            unguarded_write(using=router.db_for_write(Integration)),
        ):
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
            organization_integration_id=self.organization_integration.id,
            organization_id=self.organization_integration.organization_id,
            integration_id=self.organization_integration.integration_id,
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
