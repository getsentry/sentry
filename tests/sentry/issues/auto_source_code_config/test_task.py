from collections.abc import Mapping, Sequence
from typing import Any
from unittest.mock import patch

from sentry.eventstore.models import Event
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.integrations.source_code_management.repo_trees import RepoAndBranch, RepoTree
from sentry.issues.auto_source_code_config.code_mapping import CodeMapping
from sentry.issues.auto_source_code_config.task import DeriveCodeMappingsErrorReason, process_event
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.asserts import assert_failure_metric, assert_halt_metric
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.testutils.skips import requires_snuba
from sentry.utils.locking import UnableToAcquireLock

pytestmark = [requires_snuba]

INTEGRATIONS_ROOT = "sentry.integrations.source_code_management"
ISSUES_ROOT = "sentry.issues.auto_source_code_config"
GET_TREES_FOR_ORG = f"{INTEGRATIONS_ROOT}.repo_trees.RepoTreesIntegration.get_trees_for_org"


class BaseDeriveCodeMappings(TestCase):
    platform: str
    # We may only want to change this for TestTaskBehavior when we add support
    # for other providers
    provider = "github"
    domain_name = "github.com"

    def setUp(self) -> None:
        self.integration = self.create_integration(
            organization=self.organization,
            provider=self.provider,
            external_id=self.organization.id,
            metadata={"domain_name": f"{self.domain_name}/Test-Org"},
        )

    def create_event(
        self, frames: Sequence[Mapping[str, str | bool]], platform: str | None = None
    ) -> Event:
        """Helper function to prevent creating an event without a platform."""
        test_data = {"platform": platform or self.platform, "stacktrace": {"frames": frames}}
        return self.store_event(data=test_data, project_id=self.project.id)


@patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
class TestTaskBehavior(BaseDeriveCodeMappings):
    """Test task behavior that is not language specific."""

    def setUp(self) -> None:
        super().setUp()
        self.event = self.create_event(
            [{"filename": "foo.py", "in_app": True}],
            platform="python",  # The platform is irrelevant for this test
        )

    def test_api_errors_halts(self, mock_record: Any) -> None:
        error = ApiError('{"message":"Not Found"}')
        with patch(GET_TREES_FOR_ORG, side_effect=error):
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            assert_halt_metric(mock_record, error)

    def test_unable_to_get_lock_halts(self, mock_record: Any) -> None:
        error = UnableToAcquireLock()
        with patch(GET_TREES_FOR_ORG, side_effect=error):
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            assert not RepositoryProjectPathConfig.objects.exists()
            assert_halt_metric(mock_record, error)

    def test_generic_errors_fail(self, mock_record: Any) -> None:
        """Failures require manual investigation."""
        with patch(GET_TREES_FOR_ORG, side_effect=Exception("foo")):
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            assert_failure_metric(mock_record, DeriveCodeMappingsErrorReason.UNEXPECTED_ERROR)


class TestGenericBehaviour(BaseDeriveCodeMappings):
    """Behaviour that is not specific to a language."""

    def test_skips_not_supported_platforms(self) -> None:
        event = self.create_event([{}], platform="elixir")
        assert event.group_id is not None
        process_event(self.project.id, event.group_id, event.event_id)
        assert len(RepositoryProjectPathConfig.objects.filter(project_id=self.project.id)) == 0

    def test_handle_existing_code_mapping(self) -> None:
        with assume_test_silo_mode_of(OrganizationIntegration):
            organization_integration = OrganizationIntegration.objects.get(
                organization_id=self.organization.id, integration=self.integration
            )
        repository = Repository.objects.create(
            name="repo",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
        )
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

        event = self.create_event(
            [
                {"in_app": True, "filename": "sentry/models/release.py"},
                {"in_app": True, "filename": "sentry/tasks.py"},
            ],
            platform="python",  # The platform is irrelevant for this test
        )
        assert event.group_id is not None
        process_event(self.project.id, event.group_id, event.event_id)
        code_mapping = RepositoryProjectPathConfig.objects.get(project_id=self.project.id)
        assert code_mapping.automatically_generated is False


class TestBackSlashDeriveCodeMappings(BaseDeriveCodeMappings):
    def setUp(self) -> None:
        super().setUp()
        self.platform = "python"
        # The lack of a \ after the drive letter in the third frame signals that
        # this is a relative path. This may be unlikely to occur in practice,
        # but worth testing nonetheless.
        self.event = self.create_event(
            [
                {"in_app": True, "filename": "\\sentry\\mouse.py"},
                {"in_app": True, "filename": "\\sentry\\dog\\cat\\parrot.py"},
                {"in_app": True, "filename": "C:sentry\\tasks.py"},
                {"in_app": True, "filename": "D:\\Users\\code\\sentry\\models\\release.py"},
            ]
        )

    def test_backslash_filename_simple(self) -> None:
        repo_name = "foo/bar"
        return_value = {
            repo_name: RepoTree(RepoAndBranch(repo_name, "master"), ["sentry/mouse.py"])
        }
        with patch(GET_TREES_FOR_ORG, return_value=return_value):
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == "\\"
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name

    def test_backslash_drive_letter_filename_simple(self) -> None:
        repo_name = "foo/bar"
        return_value = {
            repo_name: RepoTree(RepoAndBranch(repo_name, "master"), ["sentry/tasks.py"])
        }
        with patch(GET_TREES_FOR_ORG, return_value=return_value):
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == "C:sentry\\"
            assert code_mapping.source_root == "sentry/"
            assert code_mapping.repository.name == repo_name

    def test_backslash_drive_letter_filename_monoRepoAndBranch(self) -> None:
        repo_name = "foo/bar"
        return_value = {
            repo_name: RepoTree(RepoAndBranch(repo_name, "master"), ["src/sentry/tasks.py"])
        }
        with patch(GET_TREES_FOR_ORG, return_value=return_value):
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == "C:sentry\\"
            assert code_mapping.source_root == "src/sentry/"
            assert code_mapping.repository.name == repo_name

    def test_backslash_drive_letter_filename_abs_path(self) -> None:
        repo_name = "foo/bar"
        return_value = {
            repo_name: RepoTree(RepoAndBranch(repo_name, "master"), ["sentry/models/release.py"])
        }
        with patch(GET_TREES_FOR_ORG, return_value=return_value):
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == "D:\\Users\\code\\"
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name


class TestJavascriptDeriveCodeMappings(BaseDeriveCodeMappings):
    def setUp(self) -> None:
        super().setUp()
        self.platform = "javascript"
        self.event = self.create_event(
            [
                {"filename": "../node_modules/@sentry/foo/esm/hub.js", "in_app": False},
                {"filename": "./app/utils/handleXhrErrorResponse.tsx", "in_app": True},
                {"filename": "some/path/Test.tsx", "in_app": True},
                {"filename": "sentry/test_app.tsx", "in_app": True},
            ]
        )

    def test_auto_source_code_config_starts_with_period_slash(self) -> None:
        repo_name = "foo/bar"
        return_value = {
            repo_name: RepoTree(
                RepoAndBranch(repo_name, "master"),
                ["static/app/utils/handleXhrErrorResponse.tsx"],
            )
        }
        with patch(GET_TREES_FOR_ORG, return_value=return_value):
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            # ./app/foo.tsx -> app/foo.tsx -> static/app/foo.tsx
            assert code_mapping.stack_root == "./"
            assert code_mapping.source_root == "static/"
            assert code_mapping.repository.name == repo_name

    def test_auto_source_code_config_starts_with_period_slash_no_containing_directory(self) -> None:
        repo_name = "foo/bar"
        return_value = {
            repo_name: RepoTree(
                RepoAndBranch(repo_name, "master"),
                ["app/utils/handleXhrErrorResponse.tsx"],
            )
        }
        with patch(GET_TREES_FOR_ORG, return_value=return_value):
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            # ./app/foo.tsx -> app/foo.tsx -> app/foo.tsx
            assert code_mapping.stack_root == "./"
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name

    def test_auto_source_code_config_one_to_one_match(self) -> None:
        repo_name = "foo/bar"
        return_value = {
            repo_name: RepoTree(RepoAndBranch(repo_name, "master"), ["some/path/Test.tsx"])
        }
        with patch(GET_TREES_FOR_ORG, return_value=return_value):
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            # some/path/Test.tsx -> Test.tsx -> some/path/Test.tsx
            assert code_mapping.stack_root == ""
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name

    def test_auto_source_code_config_same_trailing_substring(self) -> None:
        repo_name = "foo/bar"
        return_value = {repo_name: RepoTree(RepoAndBranch(repo_name, "master"), ["sentry/app.tsx"])}
        with patch(GET_TREES_FOR_ORG, return_value=return_value):
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            assert not RepositoryProjectPathConfig.objects.exists()


class TestRubyDeriveCodeMappings(BaseDeriveCodeMappings):
    def setUp(self) -> None:
        super().setUp()
        self.platform = "ruby"
        self.event = self.create_event(
            [
                {"filename": "some/path/test.rb", "in_app": True},
                {"filename": "lib/tasks/crontask.rake", "in_app": True},
            ]
        )

    def test_auto_source_code_config_rb(self) -> None:
        repo_name = "foo/bar"
        return_value = {
            repo_name: RepoTree(RepoAndBranch(repo_name, "master"), ["some/path/test.rb"])
        }
        with patch(GET_TREES_FOR_ORG, return_value=return_value):
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == ""
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name

    def test_auto_source_code_config_rake(self) -> None:
        repo_name = "foo/bar"
        return_value = {
            repo_name: RepoTree(RepoAndBranch(repo_name, "master"), ["lib/tasks/crontask.rake"])
        }
        with patch(GET_TREES_FOR_ORG, return_value=return_value):
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == ""
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name


class TestNodeDeriveCodeMappings(BaseDeriveCodeMappings):
    def setUp(self) -> None:
        super().setUp()
        self.platform = "node"
        self.event = self.create_event(
            [
                {"filename": "app:///utils/errors.js", "in_app": True},
                {"filename": "../../../../../../packages/api/src/response.ts", "in_app": True},
                {"filename": "app:///../services/event/EventLifecycle/index.js", "in_app": True},
            ]
        )

    def test_auto_source_code_config_starts_with_app(self) -> None:
        repo_name = "foo/bar"
        return_value = {
            repo_name: RepoTree(RepoAndBranch(repo_name, "master"), ["utils/errors.js"])
        }
        with patch(GET_TREES_FOR_ORG, return_value=return_value):
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == "app:///"
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name

    def test_auto_source_code_config_starts_with_app_complex(self) -> None:
        repo_name = "foo/bar"
        return_value = {
            repo_name: RepoTree(RepoAndBranch(repo_name, "master"), ["sentry/utils/errors.js"])
        }
        with patch(GET_TREES_FOR_ORG, return_value=return_value):
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == "app:///"
            assert code_mapping.source_root == "sentry/"
            assert code_mapping.repository.name == repo_name

    def test_auto_source_code_config_starts_with_multiple_dot_dot_slash(self) -> None:
        repo_name = "foo/bar"
        return_value = {
            repo_name: RepoTree(
                RepoAndBranch(repo_name, "master"),
                ["packages/api/src/response.ts"],
            )
        }
        with patch(GET_TREES_FOR_ORG, return_value=return_value):
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == "../../../../../../"
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name

    def test_auto_source_code_config_starts_with_app_dot_dot_slash(self) -> None:
        repo_name = "foo/bar"
        return_value = {
            repo_name: RepoTree(
                RepoAndBranch(repo_name, "master"), ["services/event/EventLifecycle/index.js"]
            )
        }
        with patch(GET_TREES_FOR_ORG, return_value=return_value):
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == "app:///../"
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name


class TestGoDeriveCodeMappings(BaseDeriveCodeMappings):
    def setUp(self) -> None:
        super().setUp()
        self.platform = "go"
        self.event = self.create_event(
            [
                {"in_app": True, "filename": "/Users/JohnDoe/code/sentry/capybara.go"},
                {"in_app": True, "filename": "/Users/JohnDoe/Documents/code/sentry/kangaroo.go"},
                {"in_app": True, "filename": "/src/cmd/vroom/profile.go"},
                {"in_app": True, "filename": "Users/JohnDoe/src/sentry/main.go"},
            ],
            self.platform,
        )

    def test_auto_source_code_config_go_abs_filename(self) -> None:
        repo_name = "go_repo"
        return_value = {
            repo_name: RepoTree(RepoAndBranch(repo_name, "master"), ["sentry/capybara.go"])
        }
        with patch(GET_TREES_FOR_ORG, return_value=return_value):
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == "/Users/JohnDoe/code/"
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name

    def test_auto_source_code_config_go_long_abs_filename(self) -> None:
        repo_name = "go_repo"
        return_value = {
            repo_name: RepoTree(RepoAndBranch(repo_name, "master"), ["sentry/kangaroo.go"])
        }
        with patch(GET_TREES_FOR_ORG, return_value=return_value):
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == "/Users/JohnDoe/Documents/code/"
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name

    def test_auto_source_code_config_similar_but_incorrect_file(self) -> None:
        repo_name = "go_repo"
        return_value = {
            repo_name: RepoTree(RepoAndBranch(repo_name, "master"), ["notsentry/main.go"])
        }
        with patch(GET_TREES_FOR_ORG, return_value=return_value):
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            assert not RepositoryProjectPathConfig.objects.exists()


class TestPhpDeriveCodeMappings(BaseDeriveCodeMappings):
    def setUp(self) -> None:
        super().setUp()
        self.platform = "php"
        self.event = self.create_event(
            [
                {"in_app": True, "filename": "/sentry/capybara.php"},
                {"in_app": True, "filename": "/sentry/potato/kangaroo.php"},
                {"in_app": False, "filename": "/sentry/potato/vendor/sentry/src/functions.php"},
            ],
            self.platform,
        )

    def test_auto_source_code_config_basic_php(self) -> None:
        repo_name = "php/place"
        return_value = {
            repo_name: RepoTree(RepoAndBranch(repo_name, "master"), ["sentry/potato/kangaroo.php"])
        }
        with patch(GET_TREES_FOR_ORG, return_value=return_value):
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == "/"
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name

    def test_auto_source_code_config_different_roots_php(self) -> None:
        repo_name = "php/place"
        return_value = {
            repo_name: RepoTree(
                RepoAndBranch(repo_name, "master"), ["src/sentry/potato/kangaroo.php"]
            )
        }
        with patch(GET_TREES_FOR_ORG, return_value=return_value):
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == "/sentry/"
            assert code_mapping.source_root == "src/sentry/"
            assert code_mapping.repository.name == repo_name


class TestCSharpDeriveCodeMappings(BaseDeriveCodeMappings):
    def setUp(self) -> None:
        super().setUp()
        self.platform = "csharp"
        self.event = self.create_event(
            [
                {"in_app": True, "filename": "/sentry/capybara.cs"},
                {"in_app": True, "filename": "/sentry/potato/kangaroo.cs"},
                {"in_app": False, "filename": "/sentry/potato/vendor/sentry/src/functions.cs"},
            ],
            self.platform,
        )

        self.event_data_backslashes = self.create_event(
            [
                {"in_app": True, "filename": "\\sentry\\capybara.cs"},
                {"in_app": True, "filename": "\\sentry\\potato\\kangaroo.cs"},
            ],
            self.platform,
        )

    def test_auto_source_code_config_csharp_trivial(self) -> None:
        repo_name = "csharp/repo"
        return_value = {
            repo_name: RepoTree(RepoAndBranch(repo_name, "master"), ["sentry/potato/kangaroo.cs"])
        }
        with patch(GET_TREES_FOR_ORG, return_value=return_value):
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == "/"
            assert code_mapping.source_root == ""
            assert code_mapping.repository.name == repo_name

    def test_auto_source_code_config_different_roots_csharp(self) -> None:
        repo_name = "csharp/repo"
        return_value = {
            repo_name: RepoTree(
                RepoAndBranch(repo_name, "master"), ["src/sentry/potato/kangaroo.cs"]
            )
        }
        with patch(GET_TREES_FOR_ORG, return_value=return_value):
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            code_mapping = RepositoryProjectPathConfig.objects.all()[0]
            assert code_mapping.stack_root == "/sentry/"
            assert code_mapping.source_root == "src/sentry/"
            assert code_mapping.repository.name == repo_name

    def test_auto_source_code_config_non_in_app_frame(self) -> None:
        repo_name = "csharp/repo"
        return_value = {
            repo_name: RepoTree(RepoAndBranch(repo_name, "master"), ["sentry/src/functions.cs"])
        }
        with patch(GET_TREES_FOR_ORG, return_value=return_value):
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            assert not RepositoryProjectPathConfig.objects.exists()


class TestPythonDeriveCodeMappings(BaseDeriveCodeMappings):
    def setUp(self) -> None:
        super().setUp()
        self.platform = "python"
        self.event = self.create_event(
            [
                {"in_app": True, "filename": "sentry/tasks.py"},
                {"in_app": True, "filename": "sentry/models/release.py"},
            ]
        )

    @patch(
        "sentry.issues.auto_source_code_config.code_mapping.CodeMappingTreesHelper.generate_code_mappings",
        return_value=[
            CodeMapping(
                repo=RepoAndBranch(name="repo", branch="master"),
                stacktrace_root="sentry/models",
                source_path="src/sentry/models",
            )
        ],
    )
    def test_auto_source_code_config_single_project(self, mock_generate_code_mapping: Any) -> None:
        assert not RepositoryProjectPathConfig.objects.filter(project_id=self.project.id).exists()

        with (
            patch(
                "sentry.issues.auto_source_code_config.task.identify_stacktrace_paths",
                return_value=["sentry/models/release.py", "sentry/tasks.py"],
            ) as mock_identify_stacktraces,
            self.tasks(),
        ):
            process_event(self.project.id, self.event.group_id, self.event.event_id)

        assert mock_identify_stacktraces.call_count == 1
        code_mapping = RepositoryProjectPathConfig.objects.get(project_id=self.project.id)
        assert code_mapping.automatically_generated is True

    def test_auto_source_code_config_stack_and_source_root_do_not_match(self) -> None:
        repo_name = "foo/bar"
        return_value = {
            repo_name: RepoTree(
                RepoAndBranch(repo_name, "master"), ["src/sentry/models/release.py"]
            )
        }
        with patch(GET_TREES_FOR_ORG, return_value=return_value):
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            code_mapping = RepositoryProjectPathConfig.objects.get()
            # sentry/models/release.py -> models/release.py -> src/sentry/models/release.py
            assert code_mapping.stack_root == "sentry/"
            assert code_mapping.source_root == "src/sentry/"

    def test_auto_source_code_config_no_normalization(self) -> None:
        repo_name = "foo/bar"
        return_value = {
            repo_name: RepoTree(RepoAndBranch(repo_name, "master"), ["sentry/models/release.py"])
        }
        with patch(GET_TREES_FOR_ORG, return_value=return_value):
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            code_mapping = RepositoryProjectPathConfig.objects.get()

            assert code_mapping.stack_root == ""
            assert code_mapping.source_root == ""
