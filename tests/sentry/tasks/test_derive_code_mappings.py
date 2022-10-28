from copy import deepcopy
from unittest.mock import patch

from sentry.integrations.utils.code_mapping import CodeMapping, Repo
from sentry.models.integrations.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.organization import OrganizationStatus
from sentry.tasks.derive_code_mappings import (
    derive_code_mappings,
    derive_missing_codemappings,
    identify_stacktrace_paths,
)
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.helpers.features import with_feature


class TestIdentfiyStacktracePaths(TestCase):
    def setUp(self):
        self.organization = self.create_organization(
            status=OrganizationStatus.ACTIVE,
        )
        self.project = self.create_project(
            organization=self.organization,
            platform="python",
        )
        self.test_data_1 = {
            "message": "Kaboom!",
            "platform": "python",
            "timestamp": iso_format(before_now(days=1)),
            "stacktrace": {
                "frames": [
                    {
                        "function": "handle_set_commits",
                        "abs_path": "/usr/src/sentry/src/sentry/tasks.py",
                        "module": "sentry.tasks",
                        "in_app": False,
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
        self.test_data_2 = deepcopy(self.test_data_1)
        self.test_data_2["stacktrace"]["frames"][0]["filename"] = "sentry/test_file.py"
        self.test_data_2["stacktrace"]["frames"][1]["filename"] = "sentry/models/test_file.py"
        self.test_data_2["fingerprint"] = ["new-group"]
        self.test_data_2["timestamp"] = iso_format(before_now(days=2))

    def test_finds_stacktrace_paths_single_project(self):
        self.store_event(data=self.test_data_1, project_id=self.project.id)

        with self.tasks():
            stacktrace_paths = identify_stacktrace_paths(self.organization)
        assert self.project in stacktrace_paths
        assert sorted(stacktrace_paths[self.project]) == [
            "sentry/models/release.py",
            "sentry/tasks.py",
        ]

    def test_finds_stacktrace_paths_multiple_projects(self):
        project_2 = self.create_project(
            organization=self.organization,
            platform="python",
        )
        self.store_event(data=self.test_data_1, project_id=self.project.id)
        self.store_event(data=self.test_data_2, project_id=project_2.id)

        with self.tasks():
            stacktrace_paths = identify_stacktrace_paths(self.organization)
        assert self.project in stacktrace_paths
        assert sorted(stacktrace_paths[self.project]) == [
            "sentry/models/release.py",
            "sentry/tasks.py",
        ]
        assert project_2 in stacktrace_paths
        assert sorted(stacktrace_paths[project_2]) == [
            "sentry/models/test_file.py",
            "sentry/test_file.py",
        ]

    def test_skips_stale_projects(self):
        stale_event = deepcopy(self.test_data_1)
        stale_event["timestamp"] = iso_format(before_now(days=8))
        self.store_event(data=stale_event, project_id=self.project.id)

        with self.tasks():
            stacktrace_paths = identify_stacktrace_paths(self.organization)
        assert self.project not in stacktrace_paths

    def test_skips_outdated_events(self):
        stale_event = deepcopy(self.test_data_2)
        stale_event["timestamp"] = iso_format(before_now(days=16))
        self.store_event(data=self.test_data_1, project_id=self.project.id)
        self.store_event(data=stale_event, project_id=self.project.id)

        with self.tasks():
            stacktrace_paths = identify_stacktrace_paths(self.organization)
        assert self.project in stacktrace_paths
        assert sorted(stacktrace_paths[self.project]) == [
            "sentry/models/release.py",
            "sentry/tasks.py",
        ]

    def test_skips_nonpython_projects(self):
        self.store_event(self.test_data_1, project_id=self.project.id)
        nonpython_event = deepcopy(self.test_data_2)
        nonpython_event["platform"] = "javascript"
        self.store_event(data=nonpython_event, project_id=self.project.id)

        with self.tasks():
            stacktrace_paths = identify_stacktrace_paths(self.organization)

        assert self.project in stacktrace_paths
        assert sorted(stacktrace_paths[self.project]) == [
            "sentry/models/release.py",
            "sentry/tasks.py",
        ]

    def test_handle_duplicate_filenames_in_a_project(self):
        self.store_event(data=self.test_data_1, project_id=self.project.id)
        duplicate_event = deepcopy(self.test_data_2)
        duplicate_event["stacktrace"]["frames"].append(self.test_data_1["stacktrace"]["frames"][0])
        self.store_event(data=duplicate_event, project_id=self.project.id)

        with self.tasks():
            stacktrace_paths = identify_stacktrace_paths(self.organization)
        assert self.project in stacktrace_paths
        assert sorted(stacktrace_paths[self.project]) == [
            "sentry/models/release.py",
            "sentry/models/test_file.py",
            "sentry/tasks.py",
            "sentry/test_file.py",
        ]

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
    def test_derive_code_mappings_single_project(
        self, mock_generate_code_mappings, mock_get_trees_for_org
    ):
        self.create_integration(
            organization=self.organization,
            provider="github",
            external_id=self.organization.id,
        )
        self.store_event(data=self.test_data_2, project_id=self.project.id)

        assert not RepositoryProjectPathConfig.objects.filter(project_id=self.project.id).exists()

        with patch(
            "sentry.tasks.derive_code_mappings.identify_stacktrace_paths",
            return_value={
                self.project: ["sentry/models/release.py", "sentry/tasks.py"],
            },
        ) as mock_identify_stacktraces, self.tasks():
            derive_code_mappings(self.organization.id)

        assert mock_identify_stacktraces.call_count == 1
        assert mock_get_trees_for_org.call_count == 1
        assert mock_generate_code_mappings.call_count == 1
        code_mapping = RepositoryProjectPathConfig.objects.filter(project_id=self.project.id)
        assert code_mapping.exists()
        assert code_mapping.first().automatically_generated is True

    @patch("sentry.tasks.derive_code_mappings.derive_code_mappings.delay")
    @with_feature("organizations:derive-code-mappings")
    def test_derive_missing_code_mappings(self, mock_derive_code_mappings):
        self.create_organization()
        with self.tasks():
            derive_missing_codemappings(self)

        assert mock_derive_code_mappings.call_count == 3
