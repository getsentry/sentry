from collections.abc import Mapping, Sequence
from typing import Any
from unittest.mock import patch

from sentry.eventstore.models import Event
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.integrations.source_code_management.repo_trees import RepoAndBranch, RepoTree
from sentry.issues.auto_source_code_config.code_mapping import CodeMapping
from sentry.issues.auto_source_code_config.integration_utils import InstallationNotFoundError
from sentry.issues.auto_source_code_config.task import DeriveCodeMappingsErrorReason, process_event
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.asserts import assert_failure_metric, assert_halt_metric
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.testutils.skips import requires_snuba
from sentry.utils.locking import UnableToAcquireLock

pytestmark = [requires_snuba]

GET_TREES_FOR_ORG = (
    "sentry.integrations.source_code_management.repo_trees.RepoTreesIntegration.get_trees_for_org"
)
CODE_ROOT = "sentry.issues.auto_source_code_config"


class BaseDeriveCodeMappings(TestCase):
    # We may only want to change this for TestTaskBehavior when we add support
    # for other providers
    provider = "github"
    domain_name = "github.com"

    def setUp(self) -> None:
        self.integration = self.create_integration(
            organization=self.organization,
            provider=self.provider,
            external_id=self.organization.id,
            metadata={"domain_name": f"{self.domain_name}/test-org"},
        )

    def create_event(self, frames: Sequence[Mapping[str, str | bool]], platform: str) -> Event:
        """Helper function to prevent creating an event without a platform."""
        test_data = {"platform": platform, "stacktrace": {"frames": frames}}
        return self.store_event(data=test_data, project_id=self.project.id)

    def _get_trees_for_org(self, files: Sequence[str]) -> dict[str, RepoTree]:
        return {"test-org/repo": RepoTree(RepoAndBranch("test-org/repo", "master"), files)}

    def _process_and_assert_code_mapping(
        self, files: Sequence[str], stack_root: str, source_root: str
    ) -> None:
        with (
            patch(GET_TREES_FOR_ORG, return_value=self._get_trees_for_org(files)),
            patch("sentry.utils.metrics.incr") as mock_incr,
        ):
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            code_mappings = RepositoryProjectPathConfig.objects.all()
            assert len(code_mappings) == 1
            code_mapping = code_mappings[0]
            assert code_mapping.stack_root == stack_root
            assert code_mapping.source_root == source_root
            mock_incr.assert_called_with(
                "code_mappings.created", tags={"platform": self.event.platform}
            )

    def _process_and_assert_no_code_mapping(self, files: Sequence[str]) -> list[CodeMapping]:
        with patch(GET_TREES_FOR_ORG, return_value=self._get_trees_for_org(files)):
            code_mappings = process_event(self.project.id, self.event.group_id, self.event.event_id)
            assert not RepositoryProjectPathConfig.objects.exists()
            return code_mappings


@patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
class TestTaskBehavior(BaseDeriveCodeMappings):
    """Test task behavior that is not language specific."""

    def setUp(self) -> None:
        super().setUp()
        # The platform and event are not relevant for these tests
        self.event = self.create_event([{"filename": "foo/bar.baz", "in_app": True}], "python")

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
        with patch(GET_TREES_FOR_ORG, side_effect=Exception("foo")):
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            # Failures require manual investigation.
            assert_failure_metric(mock_record, DeriveCodeMappingsErrorReason.UNEXPECTED_ERROR)

    def test_installation_not_found(self, mock_record: Any) -> None:
        with patch(
            f"{CODE_ROOT}.task.get_installation",
            side_effect=InstallationNotFoundError("foo"),
        ):
            process_event(self.project.id, self.event.group_id, self.event.event_id)


class TestGenericBehaviour(BaseDeriveCodeMappings):
    """Behaviour that is not specific to a language."""

    def test_skips_not_supported_platforms(self) -> None:
        self._process_and_assert_no_code_mapping([])

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
            stack_root="foo/",
            source_root="src/foo/",
            repository=repository,
            organization_integration_id=organization_integration.id,
            integration_id=organization_integration.integration_id,
            organization_id=organization_integration.organization_id,
        )

        # The platform & frames are irrelevant for this test
        event = self.create_event([{"filename": "foo/bar/baz.py", "in_app": True}], "python")
        assert event.group_id is not None
        process_event(self.project.id, event.group_id, event.event_id)
        all_cm = RepositoryProjectPathConfig.objects.all()
        assert len(all_cm) == 1
        assert all_cm[0].automatically_generated is False

    def test_dry_run_platform(self) -> None:
        frame_filename = "foo/bar.py"
        file_in_repo = "src/foo/bar.py"
        with (
            patch(f"{CODE_ROOT}.task.supported_platform", return_value=True),
            patch(f"{CODE_ROOT}.task.DRY_RUN_PLATFORMS", ["other"]),
        ):
            self.event = self.create_event([{"filename": frame_filename, "in_app": True}], "other")
            # No code mapping will be stored, however, we get what would have been created
            code_mappings = self._process_and_assert_no_code_mapping([file_in_repo])
            assert len(code_mappings) == 1
            assert code_mappings[0].stacktrace_root == "foo/"
            assert code_mappings[0].source_path == "src/foo/"
            assert not RepositoryProjectPathConfig.objects.exists()


class LanguageSpecificDeriveCodeMappings(BaseDeriveCodeMappings):
    def setUp(self) -> None:
        super().setUp()
        self.event = self.create_event(self.frames, self.platform)

    @property
    def platform(self) -> str:
        raise NotImplementedError

    @property
    def frames(self) -> list[dict[str, str | bool]]:
        raise NotImplementedError


class TestBackSlashDeriveCodeMappings(LanguageSpecificDeriveCodeMappings):
    platform = "python"
    # The lack of a \ after the drive letter in the third frame signals that
    # this is a relative path. This may be unlikely to occur in practice,
    # but worth testing nonetheless.
    frames = [
        {"in_app": True, "filename": "\\sentry\\mouse.py"},
        {"in_app": True, "filename": "\\sentry\\dog\\cat\\parrot.py"},
        {"in_app": True, "filename": "C:sentry\\tasks.py"},
        {"in_app": True, "filename": "D:\\Users\\code\\sentry\\models\\release.py"},
    ]

    def test_backslash_filename_simple(self) -> None:
        self._process_and_assert_code_mapping(["sentry/mouse.py"], "\\", "")

    def test_backslash_drive_letter_filename_simple(self) -> None:
        self._process_and_assert_code_mapping(["sentry/tasks.py"], "C:sentry\\", "sentry/")

    def test_backslash_drive_letter_filename_monoRepoAndBranch(self) -> None:
        self._process_and_assert_code_mapping(["src/sentry/tasks.py"], "C:sentry\\", "src/sentry/")

    def test_backslash_drive_letter_filename_abs_path(self) -> None:
        self._process_and_assert_code_mapping(["sentry/models/release.py"], "D:\\Users\\code\\", "")


class TestJavascriptDeriveCodeMappings(LanguageSpecificDeriveCodeMappings):
    platform = "javascript"
    frames = [
        {"filename": "../node_modules/@sentry/foo/esm/hub.js", "in_app": False},  # Not in-app
        {"filename": "./app/utils/handle.tsx", "in_app": True},  # Starts with ./
        {"filename": "some/path/Test.tsx", "in_app": True},  # No special characters
    ]

    def test_auto_source_code_config_starts_with_period_slash(self) -> None:
        # ./app/utils/handle.tsx -> app/utils/handle.tsx -> static/app/utils/handle.tsx
        self._process_and_assert_code_mapping(["static/app/utils/handle.tsx"], "./", "static/")

    def test_auto_source_code_config_starts_with_period_slash_no_containing_directory(self) -> None:
        self._process_and_assert_code_mapping(["app/utils/handle.tsx"], "./", "")

    def test_auto_source_code_config_one_to_one_match(self) -> None:
        self._process_and_assert_code_mapping(["some/path/Test.tsx"], "", "")


class TestRubyDeriveCodeMappings(LanguageSpecificDeriveCodeMappings):
    platform = "ruby"
    frames = [
        {"filename": "some/path/test.rb", "in_app": True},
        {"filename": "lib/tasks/crontask.rake", "in_app": True},
    ]

    def test_auto_source_code_config_rb(self) -> None:
        self._process_and_assert_code_mapping(["some/path/test.rb"], "", "")

    def test_auto_source_code_config_rake(self) -> None:
        self._process_and_assert_code_mapping(["lib/tasks/crontask.rake"], "", "")


class TestNodeDeriveCodeMappings(LanguageSpecificDeriveCodeMappings):
    platform = "node"
    frames = [
        # It can handle app:// urls
        {"filename": "app:///utils/errors.js", "in_app": True},
        # It can handle relative paths
        {"filename": "../../packages/api/src/response.ts", "in_app": True},
        # It can handle app:// urls with dot dot slashes
        {"filename": "app:///../services/event/index.js", "in_app": True},
    ]

    def test_auto_source_code_config_starts_with_app(self) -> None:
        self._process_and_assert_code_mapping(["utils/errors.js"], "app:///", "")

    def test_auto_source_code_config_starts_with_app_complex(self) -> None:
        self._process_and_assert_code_mapping(["sentry/utils/errors.js"], "app:///", "sentry/")

    def test_auto_source_code_config_starts_with_multiple_dot_dot_slash(self) -> None:
        self._process_and_assert_code_mapping(["packages/api/src/response.ts"], "../../", "")

    def test_auto_source_code_config_starts_with_app_dot_dot_slash(self) -> None:
        self._process_and_assert_code_mapping(["services/event/index.js"], "app:///../", "")


class TestGoDeriveCodeMappings(LanguageSpecificDeriveCodeMappings):
    platform = "go"
    frames = [
        {"in_app": True, "filename": "/Users/JohnDoe/code/sentry/capybara.go"},
        {"in_app": True, "filename": "/Users/JohnDoe/code/sentry/kangaroo.go"},
        {"in_app": True, "filename": "/src/cmd/vroom/profile.go"},
        {"in_app": True, "filename": "Users/JohnDoe/src/sentry/main.go"},
    ]

    def test_auto_source_code_config_go_abs_filename(self) -> None:
        self._process_and_assert_code_mapping(["sentry/capybara.go"], "/Users/JohnDoe/code/", "")

    def test_auto_source_code_config_go_long_abs_filename(self) -> None:
        self._process_and_assert_code_mapping(["sentry/kangaroo.go"], "/Users/JohnDoe/code/", "")

    def test_auto_source_code_config_similar_but_incorrect_file(self) -> None:
        self._process_and_assert_no_code_mapping(["notsentry/main.go"])


class TestPhpDeriveCodeMappings(LanguageSpecificDeriveCodeMappings):
    platform = "php"
    frames = [
        {"in_app": True, "filename": "/sentry/capybara.php"},
        {"in_app": True, "filename": "/sentry/p/kanga.php"},
        {"in_app": False, "filename": "/sentry/p/vendor/sentry/src/functions.php"},
    ]

    def test_auto_source_code_config_basic_php(self) -> None:
        self._process_and_assert_code_mapping(["sentry/p/kanga.php"], "/", "")

    def test_auto_source_code_config_different_roots_php(self) -> None:
        self._process_and_assert_code_mapping(["src/sentry/p/kanga.php"], "/sentry/", "src/sentry/")


class TestCSharpDeriveCodeMappings(LanguageSpecificDeriveCodeMappings):
    platform = "csharp"
    frames = [
        {"in_app": True, "filename": "/sentry/capybara.cs"},
        {"in_app": True, "filename": "/sentry/p/kanga.cs"},
        {"in_app": False, "filename": "/sentry/p/vendor/sentry/src/functions.cs"},
    ]

    def test_auto_source_code_config_csharp_trivial(self) -> None:
        self._process_and_assert_code_mapping(["sentry/p/kanga.cs"], "/", "")

    def test_auto_source_code_config_different_roots_csharp(self) -> None:
        self._process_and_assert_code_mapping(["src/sentry/p/kanga.cs"], "/sentry/", "src/sentry/")

    def test_auto_source_code_config_non_in_app_frame(self) -> None:
        self._process_and_assert_no_code_mapping(["sentry/src/functions.cs"])


class TestPythonDeriveCodeMappings(LanguageSpecificDeriveCodeMappings):
    platform = "python"
    frames = [
        {"in_app": True, "filename": "sentry/tasks.py"},
        {"in_app": True, "filename": "sentry/foo/bar.py"},
    ]

    def test_auto_source_code_config_stack_and_source_root_do_not_match(self) -> None:
        self._process_and_assert_code_mapping(["src/sentry/foo/bar.py"], "sentry/", "src/sentry/")

    def test_auto_source_code_config_no_normalization(self) -> None:
        self._process_and_assert_code_mapping(["sentry/foo/bar.py"], "", "")


class TestJavaDeriveCodeMappings(LanguageSpecificDeriveCodeMappings):
    platform = "java"
    frames = [
        # {"module": "kotlinx.coroutines.scheduling.Foo$Worker"},
        # {"module": "io.sentry.foo.Baz", "abs_path": "Baz.kt"},
        {"module": "a.SomeShortPackageNameClass"},
        {"module": "com.example.foo.Bar$handle$1", "abs_path": "Bar.kt"},
    ]

    def test_handles_two_levels_of_directories_and_dollar_sign_in_module(self) -> None:
        with override_options({"issues.auto_source_code_config.dry-run-platforms": ["java"]}):
            # No code mapping will be stored, however, we get what would have been created
            code_mappings = self._process_and_assert_no_code_mapping(["src/com/example/foo/Bar.kt"])
            assert len(code_mappings) == 1
            # Two levels of directories implies that we're not including the package name,
            # thus, making a more generic code mapping.
            assert code_mappings[0].stacktrace_root == "com/example/"
            assert code_mappings[0].source_path == "src/com/example/"

    def test_module_is_too_short(self) -> None:
        with override_options({"issues.auto_source_code_config.dry-run-platforms": ["java"]}):
            # This is to prove that we will prevent code mappings when the module is too short
            # to be a valid code mapping.
            code_mappings = self._process_and_assert_no_code_mapping(["src/com/foo/Short.kt"])
            assert len(code_mappings) == 0
