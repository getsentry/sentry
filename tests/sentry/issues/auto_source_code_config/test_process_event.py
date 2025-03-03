from collections.abc import Mapping, Sequence
from typing import Any, cast
from unittest.mock import patch

from sentry.eventstore.models import GroupEvent
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

    def create_event(self, frames: Sequence[Mapping[str, str | bool]], platform: str) -> GroupEvent:
        """Helper function to prevent creating an event without a platform."""
        test_data = {"platform": platform, "stacktrace": {"frames": frames}}
        # XXX: In the future fix store_event to return the correct type
        return cast(GroupEvent, self.store_event(data=test_data, project_id=self.project.id))

    def _get_trees_for_org(self, files: Sequence[str]) -> dict[str, RepoTree]:
        return {"test-org/repo": RepoTree(RepoAndBranch("test-org/repo", "master"), files)}

    def _process_and_assert_code_mapping(
        self,
        *,  # Force keyword arguments
        repo_files: Sequence[str],
        frames: Sequence[Mapping[str, str | bool]],
        platform: str,
        expected_stack_root: str,
        expected_source_root: str,
    ) -> None:
        with (
            patch(GET_TREES_FOR_ORG, return_value=self._get_trees_for_org(repo_files)),
            patch("sentry.utils.metrics.incr") as mock_incr,
        ):
            event = self.create_event(frames, platform)
            process_event(self.project.id, event.group_id, event.event_id)
            code_mappings = RepositoryProjectPathConfig.objects.all()
            assert len(code_mappings) == 1
            code_mapping = code_mappings[0]
            assert code_mapping.stack_root == expected_stack_root
            assert code_mapping.source_root == expected_source_root
            mock_incr.assert_called_with("code_mappings.created", tags={"platform": event.platform})

    def _process_and_assert_no_code_mapping(
        self,
        *,  # Force keyword arguments
        repo_files: Sequence[str],
        frames: Sequence[Mapping[str, str | bool]],
        platform: str,
    ) -> list[CodeMapping]:
        with patch(GET_TREES_FOR_ORG, return_value=self._get_trees_for_org(repo_files)):
            event = self.create_event(frames, platform)
            code_mappings = process_event(self.project.id, event.group_id, event.event_id)
            assert not RepositoryProjectPathConfig.objects.exists()
            return code_mappings

    def frame(self, filename: str, in_app: bool | None = True) -> dict[str, str | bool]:
        frame: dict[str, str | bool] = {"filename": filename}
        if in_app and in_app is not None:
            frame["in_app"] = in_app
        return frame


@patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
class TestTaskBehavior(BaseDeriveCodeMappings):
    """Test task behavior that is not language specific."""

    def setUp(self) -> None:
        super().setUp()
        # The platform and event are not relevant for these tests
        self.event = self.create_event([self.frame("foo/bar.baz", True)], "python")

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
        self._process_and_assert_no_code_mapping(repo_files=[], frames=[{}], platform="other")

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
        event = self.create_event([self.frame("foo/bar/baz.py", True)], "python")
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
            patch(f"{CODE_ROOT}.task.is_dry_run_platform", return_value=True),
        ):
            # No code mapping will be stored, however, we get what would have been created
            code_mappings = self._process_and_assert_no_code_mapping(
                repo_files=[file_in_repo],
                frames=[self.frame(frame_filename, True)],
                platform="other",
            )
            assert len(code_mappings) == 1
            assert code_mappings[0].stacktrace_root == "foo/"
            assert code_mappings[0].source_path == "src/foo/"
            assert not RepositoryProjectPathConfig.objects.exists()


class LanguageSpecificDeriveCodeMappings(BaseDeriveCodeMappings):
    @property
    def platform(self) -> str:
        raise NotImplementedError

    @property
    def frames(self) -> list[dict[str, str | bool]]:
        raise NotImplementedError


class TestBackSlashDeriveCodeMappings(LanguageSpecificDeriveCodeMappings):
    platform = "python"

    def test_backslash_filename_simple(self) -> None:
        # The lack of a \ after the drive letter in the third frame signals that
        # this is a relative path. This may be unlikely to occur in practice,
        # but worth testing nonetheless.
        self._process_and_assert_code_mapping(
            repo_files=["sentry/mouse.py"],
            frames=[self.frame("\\sentry\\mouse.py", True)],
            platform=self.platform,
            expected_stack_root="\\",
            expected_source_root="",
        )

    def test_backslash_drive_letter_filename_simple(self) -> None:
        self._process_and_assert_code_mapping(
            repo_files=["sentry/tasks.py"],
            frames=[self.frame("C:sentry\\tasks.py", True)],
            platform=self.platform,
            expected_stack_root="C:sentry\\",
            expected_source_root="sentry/",
        )

    def test_backslash_drive_letter_filename_monoRepoAndBranch(self) -> None:
        self._process_and_assert_code_mapping(
            repo_files=["sentry/tasks.py"],
            frames=[self.frame("C:sentry\\tasks.py", True)],
            platform=self.platform,
            expected_stack_root="C:sentry\\",
            expected_source_root="sentry/",
        )

    def test_backslash_drive_letter_filename_abs_path(self) -> None:
        self._process_and_assert_code_mapping(
            repo_files=["sentry/models/release.py"],
            frames=[self.frame("D:\\Users\\code\\sentry\\models\\release.py", True)],
            platform=self.platform,
            expected_stack_root="D:\\Users\\code\\",
            expected_source_root="",
        )


class TestJavascriptDeriveCodeMappings(LanguageSpecificDeriveCodeMappings):
    platform = "javascript"

    def test_auto_source_code_config_starts_with_period_slash(self) -> None:
        # ./app/utils/handle.tsx -> app/utils/handle.tsx -> static/app/utils/handle.tsx
        self._process_and_assert_code_mapping(
            repo_files=["static/app/utils/handle.tsx"],
            frames=[self.frame("./app/utils/handle.tsx", True)],
            platform=self.platform,
            expected_stack_root="./",
            expected_source_root="static/",
        )

    def test_auto_source_code_config_starts_with_period_slash_no_containing_directory(self) -> None:
        self._process_and_assert_code_mapping(
            repo_files=["app/utils/handle.tsx"],
            frames=[self.frame("./app/utils/handle.tsx", True)],
            platform=self.platform,
            expected_stack_root="./",
            expected_source_root="",
        )

    def test_auto_source_code_config_one_to_one_match(self) -> None:
        self._process_and_assert_code_mapping(
            repo_files=["some/path/Test.tsx"],
            frames=[self.frame("some/path/Test.tsx", True)],
            platform=self.platform,
            expected_stack_root="",
            expected_source_root="",
        )


class TestRubyDeriveCodeMappings(LanguageSpecificDeriveCodeMappings):
    platform = "ruby"

    def test_auto_source_code_config_rb(self) -> None:
        self._process_and_assert_code_mapping(
            repo_files=["some/path/test.rb"],
            frames=[self.frame("some/path/test.rb", True)],
            platform=self.platform,
            expected_stack_root="",
            expected_source_root="",
        )

    def test_auto_source_code_config_rake(self) -> None:
        self._process_and_assert_code_mapping(
            repo_files=["lib/tasks/crontask.rake"],
            frames=[self.frame("lib/tasks/crontask.rake", True)],
            platform=self.platform,
            expected_stack_root="",
            expected_source_root="",
        )


class TestNodeDeriveCodeMappings(LanguageSpecificDeriveCodeMappings):
    platform = "node"

    def test_auto_source_code_config_starts_with_app(self) -> None:
        # It can handle app:// urls
        self._process_and_assert_code_mapping(
            repo_files=["utils/errors.js"],
            frames=[self.frame("app:///utils/errors.js", True)],
            platform=self.platform,
            expected_stack_root="app:///",
            expected_source_root="",
        )

    def test_auto_source_code_config_starts_with_app_complex(self) -> None:
        self._process_and_assert_code_mapping(
            repo_files=["sentry/utils/errors.js"],
            frames=[self.frame("app:///utils/errors.js", True)],
            platform=self.platform,
            expected_stack_root="app:///",
            expected_source_root="sentry/",
        )

    def test_auto_source_code_config_starts_with_multiple_dot_dot_slash(self) -> None:
        # It can handle relative paths
        self._process_and_assert_code_mapping(
            repo_files=["packages/api/src/response.ts"],
            frames=[self.frame("../../packages/api/src/response.ts", True)],
            platform=self.platform,
            expected_stack_root="../../",
            expected_source_root="",
        )

    def test_auto_source_code_config_starts_with_app_dot_dot_slash(self) -> None:
        # It can handle app:// urls with dot dot slashes
        self._process_and_assert_code_mapping(
            repo_files=["services/event/index.js"],
            frames=[self.frame("app:///../services/event/index.js", True)],
            platform=self.platform,
            expected_stack_root="app:///../",
            expected_source_root="",
        )


class TestGoDeriveCodeMappings(LanguageSpecificDeriveCodeMappings):
    platform = "go"

    def test_auto_source_code_config_go_abs_filename(self) -> None:
        self._process_and_assert_code_mapping(
            repo_files=["sentry/capybara.go"],
            frames=[self.frame("/Users/JohnDoe/code/sentry/capybara.go", True)],
            platform=self.platform,
            expected_stack_root="/Users/JohnDoe/code/",
            expected_source_root="",
        )

    def test_auto_source_code_config_go_long_abs_filename(self) -> None:
        self._process_and_assert_code_mapping(
            repo_files=["sentry/kangaroo.go"],
            frames=[self.frame("/Users/JohnDoe/code/sentry/kangaroo.go", True)],
            platform=self.platform,
            expected_stack_root="/Users/JohnDoe/code/",
            expected_source_root="",
        )

    def test_auto_source_code_config_similar_but_incorrect_file(self) -> None:
        self._process_and_assert_no_code_mapping(
            repo_files=["not-sentry/main.go"],
            frames=[self.frame("Users/JohnDoe/src/sentry/main.go", True)],
            platform=self.platform,
        )


class TestPhpDeriveCodeMappings(LanguageSpecificDeriveCodeMappings):
    platform = "php"
    frames = [
        {"in_app": True, "filename": "/sentry/capybara.php"},
        {"in_app": True, "filename": "/sentry/p/kanga.php"},
        {"in_app": False, "filename": "/sentry/p/vendor/sentry/src/functions.php"},
    ]

    def test_auto_source_code_config_basic_php(self) -> None:
        self._process_and_assert_code_mapping(
            repo_files=["sentry/p/kanga.php"],
            frames=[self.frame("/sentry/p/kanga.php", True)],
            platform=self.platform,
            expected_stack_root="/",
            expected_source_root="",
        )

    def test_auto_source_code_config_different_roots_php(self) -> None:
        self._process_and_assert_code_mapping(
            repo_files=["src/sentry/p/kanga.php"],
            frames=[self.frame("/sentry/p/kanga.php", True)],
            platform=self.platform,
            expected_stack_root="/sentry/",
            expected_source_root="src/sentry/",
        )


class TestCSharpDeriveCodeMappings(LanguageSpecificDeriveCodeMappings):
    platform = "csharp"

    def test_auto_source_code_config_csharp_trivial(self) -> None:
        self._process_and_assert_code_mapping(
            repo_files=["sentry/p/kanga.cs"],
            frames=[self.frame("/sentry/p/kanga.cs", True)],
            platform=self.platform,
            expected_stack_root="/",
            expected_source_root="",
        )

    def test_auto_source_code_config_different_roots_csharp(self) -> None:
        self._process_and_assert_code_mapping(
            repo_files=["src/sentry/p/kanga.cs"],
            frames=[self.frame("/sentry/p/kanga.cs", True)],
            platform=self.platform,
            expected_stack_root="/sentry/",
            expected_source_root="src/sentry/",
        )

    def test_auto_source_code_config_non_in_app_frame(self) -> None:
        self._process_and_assert_no_code_mapping(
            repo_files=["sentry/src/functions.cs"],
            frames=[self.frame("/sentry/p/vendor/sentry/src/functions.cs", False)],
            platform=self.platform,
        )


class TestPythonDeriveCodeMappings(LanguageSpecificDeriveCodeMappings):
    platform = "python"

    def test_auto_source_code_config_stack_and_source_root_do_not_match(self) -> None:
        self._process_and_assert_code_mapping(
            repo_files=["src/sentry/foo/bar.py"],
            frames=[self.frame("sentry/foo/bar.py", True)],
            platform=self.platform,
            expected_stack_root="sentry/",
            expected_source_root="src/sentry/",
        )

    def test_auto_source_code_config_no_normalization(self) -> None:
        self._process_and_assert_code_mapping(
            repo_files=["sentry/foo/bar.py"],
            frames=[self.frame("sentry/foo/bar.py", True)],
            platform=self.platform,
            expected_stack_root="",
            expected_source_root="",
        )


class TestJavaDeriveCodeMappings(LanguageSpecificDeriveCodeMappings):
    option = {"issues.auto_source_code_config.dry-run-platforms": ["java"]}
    platform = "java"

    def test_very_short_module_name(self) -> None:
        with override_options(self.option):
            # No code mapping will be stored, however, we get what would have been created
            code_mappings = self._process_and_assert_no_code_mapping(
                repo_files=["src/a/SomeShortPackageNameClass.java"],
                frames=[
                    {
                        "module": "a.SomeShortPackageNameClass",
                        "abs_path": "SomeShortPackageNameClass.java",
                    }
                ],
                platform=self.platform,
            )
            assert len(code_mappings) == 1
            assert code_mappings[0].stacktrace_root == "a/"
            assert code_mappings[0].source_path == "src/a/"

    def test_handles_dollar_sign_in_module(self) -> None:
        with override_options(self.option):
            # No code mapping will be stored, however, we get what would have been created
            code_mappings = self._process_and_assert_no_code_mapping(
                repo_files=["src/com/example/foo/Bar.kt"],
                frames=[{"module": "com.example.foo.Bar$handle$1", "abs_path": "Bar.kt"}],
                platform=self.platform,
            )
            assert len(code_mappings) == 1
            assert code_mappings[0].stacktrace_root == "com/example/foo/"
            assert code_mappings[0].source_path == "src/com/example/foo/"
