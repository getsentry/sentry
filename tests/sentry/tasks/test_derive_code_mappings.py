from copy import deepcopy
from typing import Dict, List, Union
from unittest.mock import patch

import responses

from sentry.integrations.utils.code_mapping import CodeMapping, Repo, RepoTree
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.models.integrations.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.organization import OrganizationStatus
from sentry.models.repository import Repository
from sentry.tasks.derive_code_mappings import derive_code_mappings, identify_stacktrace_paths
from sentry.testutils import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.datetime import before_now, iso_format


class BaseDeriveCodeMappings(TestCase):
    def setUp(self):
        self.organization = self.create_organization(
            status=OrganizationStatus.ACTIVE,
        )
        self.project = self.create_project(organization=self.organization)

    def generate_data(self, frames: List[Dict[str, Union[str, bool]]], platform: str = ""):
        test_data = {"platform": platform or self.platform, "stacktrace": {"frames": frames}}
        return self.store_event(data=test_data, project_id=self.project.id).data


class TestJavascriptDeriveCodeMappings(BaseDeriveCodeMappings):
    def setUp(self):
        super().setUp()
        self.platform = "javascript"
        self.event_data = self.generate_data(
            [
                {
                    "filename": "../node_modules/@sentry/browser/node_modules/@sentry/core/esm/hub.js",
                    "in_app": False,
                },
                {
                    "filename": "./app/utils/handleXhrErrorResponse.tsx",
                    "in_app": True,
                },
            ]
        )

    def test_find_stacktrace_paths_single_project(self):
        stacktrace_paths = identify_stacktrace_paths(self.event_data)
        assert stacktrace_paths == ["./app/utils/handleXhrErrorResponse.tsx"]

    def test_find_stacktrace_empty(self):
        data = self.generate_data([{}])
        data["stacktrace"]["frames"] = [None]
        stacktrace_paths = identify_stacktrace_paths(data)
        assert stacktrace_paths == []

    def test_find_stacktrace_paths_bad_data(self):
        data = self.generate_data([{}])
        data["stacktrace"]["frames"] = [
            {
                "abs_path": "https://example.com/static/chunks/foo.bar.js",
                "data": {"sourcemap": "https://example.com/_next/static/chunks/foo.bar.js.map"},
                "in_app": True,
            }
        ]
        stacktrace_paths = identify_stacktrace_paths(data)
        assert stacktrace_paths == []

    @responses.activate
    @with_feature("organizations:derive-code-mappings")
    def test_derive_code_mappings(self):
        repo_name = "foo/bar"
        self.create_integration(
            organization=self.organization,
            provider="github",
            external_id=self.organization.id,
            metadata={"domain_name": "github.com/Test-Org"},
        )
        with patch(
            "sentry.integrations.github.client.GitHubClientMixin.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(
                    Repo(repo_name, "master"), ["static/app/utils/handleXhrErrorResponse.tsx"]
                )
            }
            derive_code_mappings(self.project.id, self.event_data)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            # ./app/foo.tsx -> foo.tsx -> static/app/foo.tsx
            assert code_mapping.stack_root == "./app/"
            assert code_mapping.source_root == "static/app/"
            assert code_mapping.repository.name == repo_name


class TestPythonDeriveCodeMappings(BaseDeriveCodeMappings):
    def setUp(self):
        super().setUp()
        self.test_data = {
            "message": "Kaboom!",
            "platform": "python",
            "timestamp": iso_format(before_now(days=1)),
            "stacktrace": {
                "frames": [
                    {
                        "function": "handle_set_commits",
                        "abs_path": "/usr/src/sentry/src/sentry/tasks.py",
                        "module": "sentry.tasks",
                        "in_app": True,
                        "lineno": 30,
                        "filename": "sentry/tasks.py",
                    },
                    {
                        "function": "set_commits",
                        "abs_path": "/usr/src/sentry/src/sentry/models/release.py",
                        "module": "sentry.models.release",
                        "in_app": True,
                        "lineno": 39,
                        "filename": "sentry/models/release.py",
                    },
                ]
            },
            "fingerprint": ["put-me-in-the-control-group"],
        }

    def test_finds_stacktrace_paths_single_project(self):
        event = self.store_event(data=self.test_data, project_id=self.project.id)

        stacktrace_paths = identify_stacktrace_paths(event.data)
        assert sorted(stacktrace_paths) == [
            "sentry/models/release.py",
            "sentry/tasks.py",
        ]

    def test_handle_duplicate_filenames_in_stacktrace(self):
        data = deepcopy(self.test_data)
        data["stacktrace"]["frames"].append(self.test_data["stacktrace"]["frames"][0])
        event = self.store_event(data=data, project_id=self.project.id)

        stacktrace_paths = identify_stacktrace_paths(event.data)
        assert sorted(stacktrace_paths) == [
            "sentry/models/release.py",
            "sentry/tasks.py",
        ]

    @with_feature({"organizations:derive-code-mappings": False})
    def test_feature_off(self):
        event = self.store_event(data=self.test_data, project_id=self.project.id)

        assert not RepositoryProjectPathConfig.objects.filter(project_id=self.project.id).exists()

        with patch(
            "sentry.tasks.derive_code_mappings.identify_stacktrace_paths",
            return_value={
                self.project: ["sentry/models/release.py", "sentry/tasks.py"],
            },
        ) as mock_identify_stacktraces, self.tasks():
            derive_code_mappings(self.project.id, event.data)

        assert mock_identify_stacktraces.call_count == 0
        assert not RepositoryProjectPathConfig.objects.filter(project_id=self.project.id).exists()

    @patch("sentry.integrations.github.GitHubIntegration.get_trees_for_org")
    @patch(
        "sentry.integrations.utils.code_mapping.CodeMappingTreesHelper.generate_code_mappings",
        return_value=[
            CodeMapping(
                repo=Repo(name="repo", branch="master"),
                stacktrace_root="sentry/models",
                source_path="src/sentry/models",
            )
        ],
    )
    @with_feature("organizations:derive-code-mappings")
    def test_derive_code_mappings_single_project(
        self, mock_generate_code_mappings, mock_get_trees_for_org
    ):
        self.create_integration(
            organization=self.organization,
            provider="github",
            external_id=self.organization.id,
        )
        event = self.store_event(data=self.test_data, project_id=self.project.id)

        assert not RepositoryProjectPathConfig.objects.filter(project_id=self.project.id).exists()

        with patch(
            "sentry.tasks.derive_code_mappings.identify_stacktrace_paths",
            return_value=["sentry/models/release.py", "sentry/tasks.py"],
        ) as mock_identify_stacktraces, self.tasks():
            derive_code_mappings(self.project.id, event.data)

        assert mock_identify_stacktraces.call_count == 1
        assert mock_get_trees_for_org.call_count == 1
        assert mock_generate_code_mappings.call_count == 1
        code_mapping = RepositoryProjectPathConfig.objects.filter(project_id=self.project.id)
        assert code_mapping.exists()
        assert code_mapping.first().automatically_generated is True

    def test_skips_supported_projects(self):
        new_data = deepcopy(self.test_data)
        new_data["platform"] = "elixir"
        event = self.store_event(data=new_data, project_id=self.project.id)
        assert derive_code_mappings(self.project.id, event.data) is None

    @patch("sentry.integrations.github.GitHubIntegration.get_trees_for_org")
    @patch(
        "sentry.integrations.utils.code_mapping.CodeMappingTreesHelper.generate_code_mappings",
        return_value=[
            CodeMapping(
                repo=Repo(name="repo", branch="master"),
                stacktrace_root="sentry/models",
                source_path="src/sentry/models",
            )
        ],
    )
    @patch("sentry.tasks.derive_code_mappings.logger")
    @with_feature("organizations:derive-code-mappings")
    def test_derive_code_mappings_duplicates(
        self, mock_logger, mock_generate_code_mappings, mock_get_trees_for_org
    ):
        integration = self.create_integration(
            organization=self.organization,
            provider="github",
            external_id=self.organization.id,
        )
        organization_integration = OrganizationIntegration.objects.get(
            organization=self.organization, integration=integration
        )
        repository = Repository.objects.create(
            name="repo",
            organization_id=self.organization.id,
            integration_id=integration.id,
        )
        event = self.store_event(data=self.test_data, project_id=self.project.id)
        RepositoryProjectPathConfig.objects.create(
            project=self.project,
            stack_root="sentry/models",
            source_root="src/sentry/models",
            repository=repository,
            organization_integration=organization_integration,
        )

        assert RepositoryProjectPathConfig.objects.filter(project_id=self.project.id).exists()

        with patch(
            "sentry.tasks.derive_code_mappings.identify_stacktrace_paths",
            return_value=["sentry/models/release.py", "sentry/tasks.py"],
        ) as mock_identify_stacktraces, self.tasks():
            derive_code_mappings(self.project.id, event.data)

        assert mock_identify_stacktraces.call_count == 1
        assert mock_get_trees_for_org.call_count == 1
        assert mock_generate_code_mappings.call_count == 1
        code_mapping = RepositoryProjectPathConfig.objects.filter(project_id=self.project.id)
        assert code_mapping.exists()
        assert code_mapping.first().automatically_generated is False
        assert mock_logger.info.call_count == 1

    @patch("sentry.integrations.github.GitHubIntegration.get_trees_for_org")
    @patch(
        "sentry.integrations.utils.code_mapping.CodeMappingTreesHelper.generate_code_mappings",
        return_value=[
            CodeMapping(
                repo=Repo(name="repo", branch="master"),
                stacktrace_root="sentry/models",
                source_path="src/sentry/models",
            )
        ],
    )
    @patch("sentry.tasks.derive_code_mappings.logger")
    @with_feature("organizations:derive-code-mappings")
    def test_derive_code_mappings_dry_run(
        self, mock_logger, mock_generate_code_mappings, mock_get_trees_for_org
    ):
        self.create_integration(
            organization=self.organization,
            provider="github",
            external_id=self.organization.id,
        )
        event = self.store_event(data=self.test_data, project_id=self.project.id)

        assert not RepositoryProjectPathConfig.objects.filter(project_id=self.project.id).exists()

        with patch(
            "sentry.tasks.derive_code_mappings.identify_stacktrace_paths",
            return_value=["sentry/models/release.py", "sentry/tasks.py"],
        ) as mock_identify_stacktraces, self.tasks():
            derive_code_mappings(self.project.id, event.data, dry_run=True)

        assert mock_logger.info.call_count == 1
        assert mock_identify_stacktraces.call_count == 1
        assert mock_get_trees_for_org.call_count == 1
        assert mock_generate_code_mappings.call_count == 1

        # We should not create the code mapping for dry runs
        assert not RepositoryProjectPathConfig.objects.filter(project_id=self.project.id).exists()
