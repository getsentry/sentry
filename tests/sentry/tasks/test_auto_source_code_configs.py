from __future__ import annotations

from copy import deepcopy
from typing import Any
from unittest.mock import patch

import responses

from sentry.db.models.fields.node import NodeData
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.issues.auto_source_code_config.code_mapping import CodeMapping, Repo, RepoTree
from sentry.models.organization import OrganizationStatus
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError
from sentry.tasks.auto_source_code_configs import (
    DeriveCodeMappingsErrorReason,
    derive_code_mappings,
    identify_stacktrace_paths,
)
from sentry.testutils.asserts import assert_failure_metric, assert_halt_metric
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.testutils.skips import requires_snuba
from sentry.utils.locking import UnableToAcquireLock

pytestmark = [requires_snuba]


class BaseDeriveCodeMappings(TestCase):
    platform: str

    def setUp(self):
        self.organization = self.create_organization(
            status=OrganizationStatus.ACTIVE,
        )
        self.project = self.create_project(organization=self.organization)
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            external_id=self.organization.id,
            metadata={"domain_name": "github.com/Test-Org"},
        )

    def generate_data(self, frames: list[dict[str, str | bool]], platform: str = "") -> NodeData:
        test_data = {"platform": platform or self.platform, "stacktrace": {"frames": frames}}
        return self.store_event(data=test_data, project_id=self.project.id).data


@patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
class TestTaskBehavior(BaseDeriveCodeMappings):
    """Test task behavior that is not language specific."""

    def setUp(self):
        super().setUp()
        self.event_data = self.generate_data(
            [{"filename": "foo.py", "in_app": True}],
            platform="javascript",
        )

    def test_does_not_raise_installation_removed(self, mock_record):
        error = ApiError(
            '{"message":"Not Found","documentation_url":"https://docs.github.com/rest/reference/apps#create-an-installation-access-token-for-an-app"}'
        )
        with patch(
            "sentry.integrations.github.client.GitHubBaseClient.get_trees_for_org",
            side_effect=error,
        ):
            assert derive_code_mappings(self.project.id, self.event_data) is None
            assert_halt_metric(mock_record, error)

    @patch("sentry.tasks.auto_source_code_configs.logger")
    def test_raises_other_api_errors(self, mock_logger, mock_record):
        with patch(
            "sentry.integrations.github.client.GitHubBaseClient.get_trees_for_org",
            side_effect=ApiError("foo"),
        ):
            derive_code_mappings(self.project.id, self.event_data)
            assert mock_logger.error.call_count == 1
            assert_halt_metric(mock_record, ApiError("foo"))

    def test_unable_to_get_lock(self, mock_record):
        error = UnableToAcquireLock()
        with patch(
            "sentry.integrations.github.client.GitHubBaseClient.get_trees_for_org",
            side_effect=UnableToAcquireLock(),
        ):
            derive_code_mappings(self.project.id, self.event_data)
            assert not RepositoryProjectPathConfig.objects.exists()
            assert_failure_metric(mock_record, error)

    @patch("sentry.tasks.auto_source_code_configs.logger")
    def test_raises_generic_errors(self, mock_logger, mock_record):
        with patch(
            "sentry.integrations.github.client.GitHubBaseClient.get_trees_for_org",
            side_effect=Exception("foo"),
        ):
            derive_code_mappings(self.project.id, self.event_data)
            assert_failure_metric(mock_record, DeriveCodeMappingsErrorReason.UNEXPECTED_ERROR)


class TestBackSlashDeriveCodeMappings(BaseDeriveCodeMappings):
    def setUp(self):
        super().setUp()
        self.platform = "python"
        # The lack of a \ after the drive letter in the third frame signals that
        # this is a relative path. This may be unlikely to occur in practice,
        # but worth testing nonetheless.
        self.event_data = self.generate_data(
            [
                {"in_app": True, "filename": "\\sentry\\mouse.py"},
                {"in_app": True, "filename": "\\sentry\\dog\\cat\\parrot.py"},
                {"in_app": True, "filename": "C:sentry\\tasks.py"},
                {"in_app": True, "filename": "D:\\Users\\code\\sentry\\models\\release.py"},
            ]
        )

    @responses.activate
    def test_backslash_filename_simple(self):
        repo_name = "foo/bar"
        with patch(
            "sentry.integrations.github.client.GitHubBaseClient.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(Repo(repo_name, "master"), ["sentry/mouse.py"])
            }
            derive_code_mappings(self.project.id, self.event_data)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == "\\"
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name

    @responses.activate
    def test_backslash_drive_letter_filename_simple(self):
        repo_name = "foo/bar"
        with patch(
            "sentry.integrations.github.client.GitHubBaseClient.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(Repo(repo_name, "master"), ["sentry/tasks.py"])
            }
            derive_code_mappings(self.project.id, self.event_data)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == "C:sentry\\"
            assert code_mapping.source_root == "sentry/"
            assert code_mapping.repository.name == repo_name

    @responses.activate
    def test_backslash_drive_letter_filename_monorepo(self):
        repo_name = "foo/bar"
        with patch(
            "sentry.integrations.github.client.GitHubBaseClient.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(Repo(repo_name, "master"), ["src/sentry/tasks.py"])
            }
            derive_code_mappings(self.project.id, self.event_data)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == "C:sentry\\"
            assert code_mapping.source_root == "src/sentry/"
            assert code_mapping.repository.name == repo_name

    @responses.activate
    def test_backslash_drive_letter_filename_abs_path(self):
        repo_name = "foo/bar"
        with patch(
            "sentry.integrations.github.client.GitHubBaseClient.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(Repo(repo_name, "master"), ["sentry/models/release.py"])
            }
            derive_code_mappings(self.project.id, self.event_data)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == "D:\\Users\\code\\"
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name


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
                {
                    "filename": "some/path/Test.tsx",
                    "in_app": True,
                },
                {
                    "filename": "sentry/test_app.tsx",
                    "in_app": True,
                },
            ]
        )

    def test_find_stacktrace_paths_single_project(self):
        stacktrace_paths = identify_stacktrace_paths(self.event_data)
        assert set(stacktrace_paths) == {
            "./app/utils/handleXhrErrorResponse.tsx",
            "some/path/Test.tsx",
            "sentry/test_app.tsx",
        }

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
    def test_derive_code_mappings_starts_with_period_slash(self):
        repo_name = "foo/bar"
        with patch(
            "sentry.integrations.github.client.GitHubBaseClient.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(
                    Repo(repo_name, "master"),
                    ["static/app/utils/handleXhrErrorResponse.tsx"],
                )
            }
            derive_code_mappings(self.project.id, self.event_data)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            # ./app/foo.tsx -> app/foo.tsx -> static/app/foo.tsx
            assert code_mapping.stack_root == "./"
            assert code_mapping.source_root == "static/"
            assert code_mapping.repository.name == repo_name

    @responses.activate
    def test_derive_code_mappings_starts_with_period_slash_no_containing_directory(self):
        repo_name = "foo/bar"
        with patch(
            "sentry.integrations.github.client.GitHubBaseClient.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(
                    Repo(repo_name, "master"),
                    ["app/utils/handleXhrErrorResponse.tsx"],
                )
            }
            derive_code_mappings(self.project.id, self.event_data)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            # ./app/foo.tsx -> app/foo.tsx -> app/foo.tsx
            assert code_mapping.stack_root == "./"
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name

    @responses.activate
    def test_derive_code_mappings_one_to_one_match(self):
        repo_name = "foo/bar"
        with patch(
            "sentry.integrations.github.client.GitHubBaseClient.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(Repo(repo_name, "master"), ["some/path/Test.tsx"])
            }
            derive_code_mappings(self.project.id, self.event_data)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            # some/path/Test.tsx -> Test.tsx -> some/path/Test.tsx
            assert code_mapping.stack_root == ""
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name

    @responses.activate
    def test_derive_code_mappings_same_trailing_substring(self):
        repo_name = "foo/bar"
        with patch(
            "sentry.integrations.github.client.GitHubBaseClient.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(Repo(repo_name, "master"), ["sentry/app.tsx"])
            }
            derive_code_mappings(self.project.id, self.event_data)
            assert not RepositoryProjectPathConfig.objects.exists()


class TestRubyDeriveCodeMappings(BaseDeriveCodeMappings):
    def setUp(self):
        super().setUp()
        self.platform = "ruby"
        self.event_data = self.generate_data(
            [
                {
                    "filename": "some/path/test.rb",
                    "in_app": True,
                },
                {
                    "filename": "lib/tasks/crontask.rake",
                    "in_app": True,
                },
            ]
        )

    def test_find_stacktrace_paths_single_project(self):
        stacktrace_paths = identify_stacktrace_paths(self.event_data)
        assert set(stacktrace_paths) == {"some/path/test.rb", "lib/tasks/crontask.rake"}

    @responses.activate
    def test_derive_code_mappings_rb(self):
        repo_name = "foo/bar"
        with patch(
            "sentry.integrations.github.client.GitHubBaseClient.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(Repo(repo_name, "master"), ["some/path/test.rb"])
            }
            derive_code_mappings(self.project.id, self.event_data)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == ""
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name

    @responses.activate
    def test_derive_code_mappings_rake(self):
        repo_name = "foo/bar"
        with patch(
            "sentry.integrations.github.client.GitHubBaseClient.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(Repo(repo_name, "master"), ["lib/tasks/crontask.rake"])
            }
            derive_code_mappings(self.project.id, self.event_data)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == ""
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name


class TestNodeDeriveCodeMappings(BaseDeriveCodeMappings):
    def setUp(self):
        super().setUp()
        self.platform = "node"
        self.event_data = self.generate_data(
            [
                {
                    "filename": "app:///utils/errors.js",
                    "in_app": True,
                },
                {
                    "filename": "../../../../../../packages/api/src/response.ts",
                    "in_app": True,
                },
                {
                    "filename": "app:///../services/event/EventLifecycle/index.js",
                    "in_app": True,
                },
            ]
        )

    def test_find_stacktrace_paths_single_project(self):
        stacktrace_paths = identify_stacktrace_paths(self.event_data)
        assert set(stacktrace_paths) == {
            "app:///utils/errors.js",
            "../../../../../../packages/api/src/response.ts",
            "app:///../services/event/EventLifecycle/index.js",
        }

    @responses.activate
    def test_derive_code_mappings_starts_with_app(self):
        repo_name = "foo/bar"
        with patch(
            "sentry.integrations.github.client.GitHubBaseClient.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(Repo(repo_name, "master"), ["utils/errors.js"])
            }
            derive_code_mappings(self.project.id, self.event_data)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == "app:///"
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name

    def test_derive_code_mappings_starts_with_app_complex(self):
        repo_name = "foo/bar"
        with patch(
            "sentry.integrations.github.client.GitHubBaseClient.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(Repo(repo_name, "master"), ["sentry/utils/errors.js"])
            }
            derive_code_mappings(self.project.id, self.event_data)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == "app:///"
            assert code_mapping.source_root == "sentry/"
            assert code_mapping.repository.name == repo_name

    @responses.activate
    def test_derive_code_mappings_starts_with_multiple_dot_dot_slash(self):
        repo_name = "foo/bar"
        with patch(
            "sentry.integrations.github.client.GitHubBaseClient.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(Repo(repo_name, "master"), ["packages/api/src/response.ts"])
            }
            derive_code_mappings(self.project.id, self.event_data)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == "../../../../../../"
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name

    @responses.activate
    def test_derive_code_mappings_starts_with_app_dot_dot_slash(self):
        repo_name = "foo/bar"
        with patch(
            "sentry.integrations.github.client.GitHubBaseClient.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(
                    Repo(repo_name, "master"), ["services/event/EventLifecycle/index.js"]
                )
            }
            derive_code_mappings(self.project.id, self.event_data)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == "app:///../"
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name


class TestGoDeriveCodeMappings(BaseDeriveCodeMappings):
    def setUp(self):
        super().setUp()
        self.platform = "go"
        self.event_data = self.generate_data(
            [
                {"in_app": True, "filename": "/Users/JohnDoe/code/sentry/capybara.go"},
                {
                    "in_app": True,
                    "filename": "/Users/JohnDoe/Documents/code/sentry/kangaroo.go",
                },
                {
                    "in_app": True,
                    "filename": "/src/cmd/vroom/profile.go",
                },
                {
                    "in_app": True,
                    "filename": "Users/JohnDoe/src/sentry/main.go",
                },
            ],
            self.platform,
        )

    @responses.activate
    def test_derive_code_mappings_go_abs_filename(self):
        repo_name = "go_repo"
        with patch(
            "sentry.integrations.github.client.GitHubBaseClient.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(Repo(repo_name, "master"), ["sentry/capybara.go"])
            }
            derive_code_mappings(self.project.id, self.event_data)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == "/Users/JohnDoe/code/"
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name

    @responses.activate
    def test_derive_code_mappings_go_long_abs_filename(self):
        repo_name = "go_repo"
        with patch(
            "sentry.integrations.github.client.GitHubBaseClient.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(Repo(repo_name, "master"), ["sentry/kangaroo.go"])
            }
            derive_code_mappings(self.project.id, self.event_data)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == "/Users/JohnDoe/Documents/code/"
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name

    @responses.activate
    def test_derive_code_mappings_similar_but_incorrect_file(self):
        repo_name = "go_repo"
        with patch(
            "sentry.integrations.github.client.GitHubBaseClient.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(Repo(repo_name, "master"), ["notsentry/main.go"])
            }
            derive_code_mappings(self.project.id, self.event_data)
            assert not RepositoryProjectPathConfig.objects.exists()


class TestPhpDeriveCodeMappings(BaseDeriveCodeMappings):
    def setUp(self):
        super().setUp()
        self.platform = "php"
        self.event_data = self.generate_data(
            [
                {"in_app": True, "filename": "/sentry/capybara.php"},
                {"in_app": True, "filename": "/sentry/potato/kangaroo.php"},
                {
                    "in_app": False,
                    "filename": "/sentry/potato/vendor/sentry/sentry/src/functions.php",
                },
            ],
            self.platform,
        )

    @responses.activate
    def test_derive_code_mappings_basic_php(self):
        repo_name = "php/place"
        with patch(
            "sentry.integrations.github.client.GitHubBaseClient.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(Repo(repo_name, "master"), ["sentry/potato/kangaroo.php"])
            }
            derive_code_mappings(self.project.id, self.event_data)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == "/"
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name

    @responses.activate
    def test_derive_code_mappings_different_roots_php(self):
        repo_name = "php/place"
        with patch(
            "sentry.integrations.github.client.GitHubBaseClient.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(Repo(repo_name, "master"), ["src/sentry/potato/kangaroo.php"])
            }
            derive_code_mappings(self.project.id, self.event_data)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == "/sentry/"
            assert code_mapping.source_root == "src/sentry/"
            assert code_mapping.repository.name == repo_name


class TestCSharpDeriveCodeMappings(BaseDeriveCodeMappings):
    def setUp(self):
        super().setUp()
        self.platform = "csharp"
        self.event_data = self.generate_data(
            [
                {"in_app": True, "filename": "/sentry/capybara.cs"},
                {"in_app": True, "filename": "/sentry/potato/kangaroo.cs"},
                {
                    "in_app": False,
                    "filename": "/sentry/potato/vendor/sentry/sentry/src/functions.cs",
                },
            ],
            self.platform,
        )

        self.event_data_backslashes = self.generate_data(
            [
                {"in_app": True, "filename": "\\sentry\\capybara.cs"},
                {"in_app": True, "filename": "\\sentry\\potato\\kangaroo.cs"},
            ],
            self.platform,
        )

    @responses.activate
    def test_derive_code_mappings_csharp_trivial(self):
        repo_name = "csharp/repo"
        with patch(
            "sentry.integrations.github.client.GitHubBaseClient.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(Repo(repo_name, "master"), ["sentry/potato/kangaroo.cs"])
            }
            derive_code_mappings(self.project.id, self.event_data)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == "/"
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name

    @responses.activate
    def test_derive_code_mappings_different_roots_csharp(self):
        repo_name = "csharp/repo"
        with patch(
            "sentry.integrations.github.client.GitHubBaseClient.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(Repo(repo_name, "master"), ["src/sentry/potato/kangaroo.cs"])
            }
            derive_code_mappings(self.project.id, self.event_data)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == "/sentry/"
            assert code_mapping.source_root == "src/sentry/"
            assert code_mapping.repository.name == repo_name

    @responses.activate
    def test_derive_code_mappings_non_in_app_frame(self):
        repo_name = "csharp/repo"
        with patch(
            "sentry.integrations.github.client.GitHubBaseClient.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(Repo(repo_name, "master"), ["sentry/src/functions.cs"])
            }
            derive_code_mappings(self.project.id, self.event_data)
            assert not RepositoryProjectPathConfig.objects.exists()


class TestPythonDeriveCodeMappings(BaseDeriveCodeMappings):
    def setUp(self):
        super().setUp()
        self.test_data: dict[str, Any] = {
            "platform": "python",
            "stacktrace": {
                "frames": [
                    {"in_app": True, "filename": "sentry/tasks.py"},
                    {"in_app": True, "filename": "sentry/models/release.py"},
                ]
            },
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

    @patch("sentry.integrations.github.integration.GitHubIntegration.get_trees_for_org")
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
        event = self.store_event(data=self.test_data, project_id=self.project.id)

        assert not RepositoryProjectPathConfig.objects.filter(project_id=self.project.id).exists()

        with (
            patch(
                "sentry.tasks.auto_source_code_configs.identify_stacktrace_paths",
                return_value=["sentry/models/release.py", "sentry/tasks.py"],
            ) as mock_identify_stacktraces,
            self.tasks(),
        ):
            derive_code_mappings(self.project.id, event.data)

        assert mock_identify_stacktraces.call_count == 1
        assert mock_get_trees_for_org.call_count == 1
        assert mock_generate_code_mappings.call_count == 1
        code_mapping = RepositoryProjectPathConfig.objects.get(project_id=self.project.id)
        assert code_mapping.automatically_generated is True

    def test_skips_not_supported_platforms(self):
        data = self.generate_data([{}], platform="elixir")
        assert derive_code_mappings(self.project.id, data) is None
        assert len(RepositoryProjectPathConfig.objects.filter(project_id=self.project.id)) == 0

    @patch("sentry.integrations.github.integration.GitHubIntegration.get_trees_for_org")
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
    @patch("sentry.tasks.auto_source_code_configs.logger")
    def test_derive_code_mappings_duplicates(
        self, mock_logger, mock_generate_code_mappings, mock_get_trees_for_org
    ):
        with assume_test_silo_mode_of(OrganizationIntegration):
            organization_integration = OrganizationIntegration.objects.get(
                organization_id=self.organization.id, integration=self.integration
            )
        repository = Repository.objects.create(
            name="repo",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
        )
        event = self.store_event(data=self.test_data, project_id=self.project.id)
        RepositoryProjectPathConfig.objects.create(
            project=self.project,
            stack_root="sentry/models",
            source_root="src/sentry/models",
            repository=repository,
            organization_integration_id=organization_integration.id,
            integration_id=organization_integration.integration_id,
            organization_id=organization_integration.organization_id,
        )

        assert RepositoryProjectPathConfig.objects.filter(project_id=self.project.id).exists()

        with (
            patch(
                "sentry.tasks.auto_source_code_configs.identify_stacktrace_paths",
                return_value=["sentry/models/release.py", "sentry/tasks.py"],
            ) as mock_identify_stacktraces,
            self.tasks(),
        ):
            derive_code_mappings(self.project.id, event.data)

        assert mock_identify_stacktraces.call_count == 1
        assert mock_get_trees_for_org.call_count == 1
        assert mock_generate_code_mappings.call_count == 1
        code_mapping = RepositoryProjectPathConfig.objects.get(project_id=self.project.id)
        assert code_mapping.automatically_generated is False
        assert mock_logger.info.call_count == 1

    @responses.activate
    def test_derive_code_mappings_stack_and_source_root_do_not_match(self):
        repo_name = "foo/bar"
        with patch(
            "sentry.integrations.github.client.GitHubBaseClient.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(Repo(repo_name, "master"), ["src/sentry/models/release.py"])
            }
            derive_code_mappings(self.project.id, self.test_data)
            code_mapping = RepositoryProjectPathConfig.objects.get()
            # sentry/models/release.py -> models/release.py -> src/sentry/models/release.py
            assert code_mapping.stack_root == "sentry/"
            assert code_mapping.source_root == "src/sentry/"

    @responses.activate
    def test_derive_code_mappings_no_normalization(self):
        repo_name = "foo/bar"
        with patch(
            "sentry.integrations.github.client.GitHubBaseClient.get_trees_for_org"
        ) as mock_get_trees_for_org:
            mock_get_trees_for_org.return_value = {
                repo_name: RepoTree(Repo(repo_name, "master"), ["sentry/models/release.py"])
            }
            derive_code_mappings(self.project.id, self.test_data)
            code_mapping = RepositoryProjectPathConfig.objects.get()

            assert code_mapping.stack_root == ""
            assert code_mapping.source_root == ""
