from copy import deepcopy
from unittest.mock import patch

from sentry.integrations.utils.code_mapping import CodeMapping, Repo
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.models.integrations.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.organization import OrganizationStatus
from sentry.models.repository import Repository
from sentry.tasks.derive_code_mappings import derive_code_mappings, identify_stacktrace_paths
from sentry.testutils import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.datetime import before_now, iso_format


class TestIdentfiyStacktracePaths(TestCase):
    def setUp(self):
        self.organization = self.create_organization(
            status=OrganizationStatus.ACTIVE,
        )
        self.project = self.create_project(
            organization=self.organization,
            platform="python",
        )
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

        with self.tasks():
            stacktrace_paths = identify_stacktrace_paths(event.data)
        assert sorted(stacktrace_paths) == [
            "sentry/models/release.py",
            "sentry/tasks.py",
        ]

    def test_skips_nonpython_projects(self):
        new_data = deepcopy(self.test_data)
        new_data["platform"] = "javascript"
        event = self.store_event(data=new_data, project_id=self.project.id)

        with self.tasks():
            stacktrace_paths = identify_stacktrace_paths(event.data)

        assert sorted(stacktrace_paths) == []

    def test_handle_duplicate_filenames_in_stacktrace(self):
        data = deepcopy(self.test_data)
        data["stacktrace"]["frames"].append(self.test_data["stacktrace"]["frames"][0])
        event = self.store_event(data=data, project_id=self.project.id)

        with self.tasks():
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
