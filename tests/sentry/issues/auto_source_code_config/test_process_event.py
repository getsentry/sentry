from collections.abc import Mapping, Sequence
from typing import Any, TypedDict, cast
from unittest.mock import patch

from sentry.eventstore.models import GroupEvent
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.issues.auto_source_code_config.constants import METRIC_PREFIX
from sentry.issues.auto_source_code_config.integration_utils import InstallationNotFoundError
from sentry.issues.auto_source_code_config.task import DeriveCodeMappingsErrorReason, process_event
from sentry.issues.auto_source_code_config.utils import PlatformConfig
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.asserts import assert_failure_metric, assert_halt_metric
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.testutils.skips import requires_snuba
from sentry.utils.locking import UnableToAcquireLock

pytestmark = [requires_snuba]

CODE_ROOT = "sentry.issues.auto_source_code_config"
REPO_TREES_CODE = "sentry.integrations.source_code_management.repo_trees"
REPO_TREES_INTEGRATION = f"{REPO_TREES_CODE}.RepoTreesIntegration"
# XXX: This will need to get fixed once we support other providers
CLIENT = "sentry.integrations.github.client.GitHubBaseClient"
REPO1 = "test-org/repo1"
REPO2 = "test-org/repo2"


class ExpectedCodeMapping(TypedDict):
    stack_root: str
    source_root: str
    repo_name: str


def _repo_info(name: str, branch: str) -> dict[str, str]:
    return {"full_name": name, "default_branch": branch}


def _repo_tree_files(files: Sequence[str]) -> list[dict[str, Any]]:
    return [{"path": file, "type": "blob"} for file in files]


def create_mock_get_tree(repo_trees: Mapping[str, Sequence[str]]) -> Any:
    def mock_get_tree(repo_name: str, ref: str) -> list[dict[str, Any]]:
        return _repo_tree_files(repo_trees.get(repo_name, []))

    return mock_get_tree


def mock_populate_repositories() -> list[dict[str, str]]:
    return [
        _repo_info(REPO1, "master"),
        _repo_info(REPO2, "master"),
    ]


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

    def _process_and_assert_configuration_changes(
        self,
        *,  # Force keyword arguments
        repo_trees: Mapping[str, Sequence[str]],
        frames: Sequence[Mapping[str, str | bool]],
        platform: str,
        expected_new_code_mappings: Sequence[ExpectedCodeMapping] | None = None,
        expected_num_code_mappings: int = 1,
        expected_in_app_stack_trace_rules: list[str] | None = None,
    ) -> GroupEvent:
        platform_config = PlatformConfig(platform)
        dry_run = platform_config.is_dry_run_platform()
        tags = {"dry_run": dry_run, "platform": platform}
        with (
            patch(f"{CLIENT}.get_tree", side_effect=create_mock_get_tree(repo_trees)),
            patch(f"{CLIENT}.get_remaining_api_requests", return_value=500),
            patch(
                f"{REPO_TREES_INTEGRATION}._populate_repositories",
                return_value=mock_populate_repositories(),
            ),
            patch("sentry.utils.metrics.incr") as mock_incr,
        ):
            starting_repositories_count = Repository.objects.all().count()
            starting_code_mappings_count = RepositoryProjectPathConfig.objects.all().count()
            event = self.create_event(frames, platform)
            dry_run_code_mappings, in_app_stack_trace_rules = process_event(
                self.project.id, event.group_id, event.event_id
            )

            code_mappings = RepositoryProjectPathConfig.objects.all()

            if dry_run:
                # If dry run, no configurations should have been created
                assert starting_code_mappings_count == code_mappings.count()
                assert starting_repositories_count == Repository.objects.all().count()

                if expected_new_code_mappings:
                    assert len(dry_run_code_mappings) == len(expected_new_code_mappings)
                    for cm, expected_cm in zip(dry_run_code_mappings, expected_new_code_mappings):
                        assert cm.stacktrace_root == expected_cm["stack_root"]
                        assert cm.source_path == expected_cm["source_root"]
                        assert cm.repo.name == expected_cm["repo_name"]

                mock_incr.assert_any_call(
                    key=f"{METRIC_PREFIX}.repository.created", tags=tags, sample_rate=1.0
                )
                mock_incr.assert_any_call(
                    key=f"{METRIC_PREFIX}.code_mapping.created", tags=tags, sample_rate=1.0
                )
            else:
                assert code_mappings.count() == expected_num_code_mappings
                if expected_new_code_mappings:
                    assert code_mappings.count() == starting_code_mappings_count + len(
                        expected_new_code_mappings
                    )
                    for expected_cm in expected_new_code_mappings:
                        code_mapping = code_mappings.filter(
                            stack_root=expected_cm["stack_root"],
                            source_root=expected_cm["source_root"],
                        ).first()
                        assert code_mapping is not None
                        assert code_mapping.repository.name == expected_cm["repo_name"]

                if Repository.objects.all().count() > starting_repositories_count:
                    mock_incr.assert_any_call(
                        key=f"{METRIC_PREFIX}.repository.created", tags=tags, sample_rate=1.0
                    )

                if code_mappings.count() > starting_code_mappings_count:
                    mock_incr.assert_any_call(
                        key=f"{METRIC_PREFIX}.code_mapping.created", tags=tags, sample_rate=1.0
                    )

            if expected_in_app_stack_trace_rules is not None:
                # XXX: Grab it from the option
                assert expected_in_app_stack_trace_rules == in_app_stack_trace_rules

            # Returning these to inspect the results
            return event

    def frame(
        self,
        filename: str | None = None,
        in_app: bool | None = True,
        module: str | None = None,
        abs_path: str | None = None,
    ) -> dict[str, str | bool]:
        frame: dict[str, str | bool] = {}
        if filename:
            frame["filename"] = filename
        if module:
            frame["module"] = module
        if abs_path:
            frame["abs_path"] = abs_path
        if in_app and in_app is not None:
            frame["in_app"] = in_app
        return frame

    def code_mapping(
        self,
        stack_root: str,
        source_root: str,
        repo_name: str = REPO1,
    ) -> ExpectedCodeMapping:
        return {"stack_root": stack_root, "source_root": source_root, "repo_name": repo_name}


@patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
class TestTaskBehavior(BaseDeriveCodeMappings):
    """Test task behavior that is not language specific."""

    def setUp(self) -> None:
        super().setUp()
        # The platform and event are not relevant for these tests
        self.event = self.create_event([self.frame("foo/bar.baz", True)], "python")

    def test_api_errors_halts(self, mock_record: Any) -> None:
        error = ApiError('{"message":"Not Found"}')
        with patch(f"{REPO_TREES_INTEGRATION}.get_trees_for_org", side_effect=error):
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            assert_halt_metric(mock_record, error)

    def test_unable_to_get_lock_halts(self, mock_record: Any) -> None:
        error = UnableToAcquireLock()
        with patch(f"{REPO_TREES_INTEGRATION}.get_trees_for_org", side_effect=error):
            process_event(self.project.id, self.event.group_id, self.event.event_id)
            assert not RepositoryProjectPathConfig.objects.exists()
            assert_halt_metric(mock_record, error)

    def test_generic_errors_fail(self, mock_record: Any) -> None:
        with patch(f"{REPO_TREES_INTEGRATION}.get_trees_for_org", side_effect=Exception("foo")):
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
        with patch(f"{CODE_ROOT}.utils.get_platform_config", return_value={}):
            self._process_and_assert_configuration_changes(
                repo_trees={}, frames=[{}], platform="other", expected_num_code_mappings=0
            )

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
        platform = "other"
        with (
            patch(f"{CODE_ROOT}.utils.get_platform_config", return_value={}),
            patch(f"{CODE_ROOT}.utils.PlatformConfig.is_supported", return_value=True),
            patch(f"{CODE_ROOT}.utils.PlatformConfig.is_dry_run_platform", return_value=True),
        ):
            # No code mapping will be stored, however, we get what would have been created
            self._process_and_assert_configuration_changes(
                repo_trees={REPO1: [file_in_repo]},
                frames=[self.frame(frame_filename, True)],
                platform=platform,
                expected_new_code_mappings=[self.code_mapping("foo/", "src/foo/")],
                expected_num_code_mappings=0,
            )

    def test_extension_is_not_included(self) -> None:
        frame_filename = "foo/bar.tbd"
        file_in_repo = "src/foo/bar.tbd"
        platform = "other"
        self.event = self.create_event([{"filename": frame_filename, "in_app": True}], platform)

        with (
            patch(f"{CODE_ROOT}.utils.get_platform_config", return_value={}),
            patch(f"{REPO_TREES_CODE}.get_supported_extensions", return_value=[]),
        ):
            # No extensions are supported, thus, we won't generate a code mapping
            self._process_and_assert_configuration_changes(
                repo_trees={REPO1: [file_in_repo]},
                frames=[self.frame(frame_filename, True)],
                platform=platform,
                expected_num_code_mappings=0,
            )

            with patch(f"{REPO_TREES_CODE}.get_supported_extensions", return_value=["tbd"]):
                self._process_and_assert_configuration_changes(
                    repo_trees={REPO1: [file_in_repo]},
                    frames=[self.frame(frame_filename, True)],
                    platform=platform,
                    expected_new_code_mappings=[self.code_mapping("foo/", "src/foo/")],
                )

    def test_multiple_calls(self) -> None:
        platform = "other"
        # XXX: We need a test for when repo_files changes over time
        repo_trees = {
            REPO1: ["src/foo/bar.py", "src/app/main.py"],
            REPO2: ["app/baz/qux.py"],
        }
        with (
            patch(f"{CODE_ROOT}.utils.get_platform_config", return_value={}),
            patch(f"{CODE_ROOT}.utils.PlatformConfig.is_supported", return_value=True),
        ):
            self._process_and_assert_configuration_changes(
                repo_trees=repo_trees,
                frames=[self.frame("foo/bar.py", True)],
                platform=platform,
                expected_new_code_mappings=[self.code_mapping("foo/", "src/foo/")],
            )
            # Processing the same stacktrace again should not create anything new,
            # thus, not passing in expected_new_code_mapping
            self._process_and_assert_configuration_changes(
                repo_trees=repo_trees, frames=[self.frame("foo/bar.py", True)], platform=platform
            )
            # New code mapping in the same repository
            self._process_and_assert_configuration_changes(
                repo_trees=repo_trees,
                frames=[self.frame("app/main.py", True)],
                platform=platform,
                expected_new_code_mappings=[self.code_mapping("app/", "src/app/")],
                expected_num_code_mappings=2,  # New code mapping
            )
            # New code mapping in a different repository
            self._process_and_assert_configuration_changes(
                repo_trees=repo_trees,
                frames=[self.frame("baz/qux.py", True)],
                platform=platform,
                expected_new_code_mappings=[self.code_mapping("baz/", "app/baz/", REPO2)],
                expected_num_code_mappings=3,
            )


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
        self._process_and_assert_configuration_changes(
            repo_trees={REPO1: ["sentry/mouse.py"]},
            frames=[self.frame("\\sentry\\mouse.py", True)],
            platform=self.platform,
            expected_new_code_mappings=[self.code_mapping("\\", "")],
        )

    def test_backslash_drive_letter_filename_simple(self) -> None:
        self._process_and_assert_configuration_changes(
            repo_trees={REPO1: ["sentry/tasks.py"]},
            frames=[self.frame("C:sentry\\tasks.py", True)],
            platform=self.platform,
            expected_new_code_mappings=[self.code_mapping("C:sentry\\", "sentry/")],
        )

    def test_backslash_drive_letter_filename_monoRepoAndBranch(self) -> None:
        self._process_and_assert_configuration_changes(
            repo_trees={REPO1: ["sentry/tasks.py"]},
            frames=[self.frame("C:sentry\\tasks.py", True)],
            platform=self.platform,
            expected_new_code_mappings=[self.code_mapping("C:sentry\\", "sentry/")],
        )

    def test_backslash_drive_letter_filename_abs_path(self) -> None:
        self._process_and_assert_configuration_changes(
            repo_trees={REPO1: ["sentry/models/release.py"]},
            frames=[self.frame("D:\\Users\\code\\sentry\\models\\release.py", True)],
            platform=self.platform,
            expected_new_code_mappings=[self.code_mapping("D:\\Users\\code\\", "")],
        )


class TestJavascriptDeriveCodeMappings(LanguageSpecificDeriveCodeMappings):
    platform = "javascript"

    def test_auto_source_code_config_starts_with_period_slash(self) -> None:
        # ./app/utils/handle.tsx -> app/utils/handle.tsx -> static/app/utils/handle.tsx
        self._process_and_assert_configuration_changes(
            repo_trees={REPO1: ["static/app/utils/handle.tsx"]},
            frames=[self.frame("./app/utils/handle.tsx", True)],
            platform=self.platform,
            expected_new_code_mappings=[self.code_mapping("./", "static/")],
        )

    def test_auto_source_code_config_starts_with_period_slash_no_containing_directory(self) -> None:
        self._process_and_assert_configuration_changes(
            repo_trees={REPO1: ["app/utils/handle.tsx"]},
            frames=[self.frame("./app/utils/handle.tsx", True)],
            platform=self.platform,
            expected_new_code_mappings=[self.code_mapping("./", "")],
        )

    def test_auto_source_code_config_one_to_one_match(self) -> None:
        self._process_and_assert_configuration_changes(
            repo_trees={REPO1: ["some/path/Test.tsx"]},
            frames=[self.frame("some/path/Test.tsx", True)],
            platform=self.platform,
            expected_new_code_mappings=[self.code_mapping("", "")],
        )


class TestRubyDeriveCodeMappings(LanguageSpecificDeriveCodeMappings):
    platform = "ruby"

    def test_auto_source_code_config_rb(self) -> None:
        self._process_and_assert_configuration_changes(
            repo_trees={REPO1: ["some/path/test.rb"]},
            frames=[self.frame("some/path/test.rb", True)],
            platform=self.platform,
            expected_new_code_mappings=[self.code_mapping("", "")],
        )

    def test_auto_source_code_config_rake(self) -> None:
        self._process_and_assert_configuration_changes(
            repo_trees={REPO1: ["lib/tasks/crontask.rake"]},
            frames=[self.frame("lib/tasks/crontask.rake", True)],
            platform=self.platform,
            expected_new_code_mappings=[self.code_mapping("", "")],
        )


class TestNodeDeriveCodeMappings(LanguageSpecificDeriveCodeMappings):
    platform = "node"

    def test_auto_source_code_config_starts_with_app(self) -> None:
        # It can handle app:// urls
        self._process_and_assert_configuration_changes(
            repo_trees={REPO1: ["utils/errors.js"]},
            frames=[self.frame("app:///utils/errors.js", True)],
            platform=self.platform,
            expected_new_code_mappings=[self.code_mapping("app:///", "")],
        )

    def test_auto_source_code_config_starts_with_app_complex(self) -> None:
        self._process_and_assert_configuration_changes(
            repo_trees={REPO1: ["sentry/utils/errors.js"]},
            frames=[self.frame("app:///utils/errors.js", True)],
            platform=self.platform,
            expected_new_code_mappings=[self.code_mapping("app:///", "sentry/")],
        )

    def test_auto_source_code_config_starts_with_multiple_dot_dot_slash(self) -> None:
        # It can handle relative paths
        self._process_and_assert_configuration_changes(
            repo_trees={REPO1: ["packages/api/src/response.ts"]},
            frames=[self.frame("../../packages/api/src/response.ts", True)],
            platform=self.platform,
            expected_new_code_mappings=[self.code_mapping("../../", "")],
        )

    def test_auto_source_code_config_starts_with_app_dot_dot_slash(self) -> None:
        # It can handle app:// urls with dot dot slashes
        self._process_and_assert_configuration_changes(
            repo_trees={REPO1: ["services/event/index.js"]},
            frames=[self.frame("app:///../services/event/index.js", True)],
            platform=self.platform,
            expected_new_code_mappings=[self.code_mapping("app:///../", "")],
        )


class TestGoDeriveCodeMappings(LanguageSpecificDeriveCodeMappings):
    platform = "go"

    def test_auto_source_code_config_go_abs_filename(self) -> None:
        self._process_and_assert_configuration_changes(
            repo_trees={REPO1: ["sentry/capybara.go"]},
            frames=[self.frame("/Users/JohnDoe/code/sentry/capybara.go", True)],
            platform=self.platform,
            expected_new_code_mappings=[self.code_mapping("/Users/JohnDoe/code/", "")],
        )

    def test_auto_source_code_config_go_long_abs_filename(self) -> None:
        self._process_and_assert_configuration_changes(
            repo_trees={REPO1: ["sentry/kangaroo.go"]},
            frames=[self.frame("/Users/JohnDoe/code/sentry/kangaroo.go", True)],
            platform=self.platform,
            expected_new_code_mappings=[self.code_mapping("/Users/JohnDoe/code/", "")],
        )

    def test_auto_source_code_config_similar_but_incorrect_file(self) -> None:
        self._process_and_assert_configuration_changes(
            repo_trees={REPO1: ["not-sentry/main.go"]},
            frames=[self.frame("Users/JohnDoe/src/sentry/main.go", True)],
            platform=self.platform,
            expected_num_code_mappings=0,
        )


class TestPhpDeriveCodeMappings(LanguageSpecificDeriveCodeMappings):
    platform = "php"
    frames = [
        {"in_app": True, "filename": "/sentry/capybara.php"},
        {"in_app": True, "filename": "/sentry/p/kanga.php"},
        {"in_app": False, "filename": "/sentry/p/vendor/sentry/src/functions.php"},
    ]

    def test_auto_source_code_config_basic_php(self) -> None:
        self._process_and_assert_configuration_changes(
            repo_trees={REPO1: ["sentry/p/kanga.php"]},
            frames=[self.frame("/sentry/p/kanga.php", True)],
            platform=self.platform,
            expected_new_code_mappings=[self.code_mapping("/", "")],
        )

    def test_auto_source_code_config_different_roots_php(self) -> None:
        self._process_and_assert_configuration_changes(
            repo_trees={REPO1: ["src/sentry/p/kanga.php"]},
            frames=[self.frame("/sentry/p/kanga.php", True)],
            platform=self.platform,
            expected_new_code_mappings=[self.code_mapping("/sentry/", "src/sentry/")],
        )


class TestCSharpDeriveCodeMappings(LanguageSpecificDeriveCodeMappings):
    platform = "csharp"

    def test_auto_source_code_config_csharp_trivial(self) -> None:
        self._process_and_assert_configuration_changes(
            repo_trees={REPO1: ["sentry/p/kanga.cs"]},
            frames=[self.frame("/sentry/p/kanga.cs", True)],
            platform=self.platform,
            expected_new_code_mappings=[self.code_mapping("/", "")],
        )

    def test_auto_source_code_config_different_roots_csharp(self) -> None:
        self._process_and_assert_configuration_changes(
            repo_trees={REPO1: ["src/sentry/p/kanga.cs"]},
            frames=[self.frame("/sentry/p/kanga.cs", True)],
            platform=self.platform,
            expected_new_code_mappings=[self.code_mapping("/sentry/", "src/sentry/")],
        )

    def test_auto_source_code_config_non_in_app_frame(self) -> None:
        self._process_and_assert_configuration_changes(
            repo_trees={REPO1: ["sentry/src/functions.cs"]},
            frames=[self.frame("/sentry/p/vendor/sentry/src/functions.cs", False)],
            platform=self.platform,
            expected_num_code_mappings=0,
        )


class TestPythonDeriveCodeMappings(LanguageSpecificDeriveCodeMappings):
    platform = "python"

    def test_auto_source_code_config_stack_and_source_root_do_not_match(self) -> None:
        self._process_and_assert_configuration_changes(
            repo_trees={REPO1: ["src/sentry/foo/bar.py"]},
            frames=[self.frame("sentry/foo/bar.py", True)],
            platform=self.platform,
            expected_new_code_mappings=[self.code_mapping("sentry/", "src/sentry/")],
        )

    def test_auto_source_code_config_no_normalization(self) -> None:
        self._process_and_assert_configuration_changes(
            repo_trees={REPO1: ["sentry/foo/bar.py"]},
            frames=[self.frame("sentry/foo/bar.py", True)],
            platform=self.platform,
            expected_new_code_mappings=[self.code_mapping("", "")],
        )


class TestJavaDeriveCodeMappings(LanguageSpecificDeriveCodeMappings):
    platform = "java"

    def test_very_short_module_name(self) -> None:
        # No code mapping will be stored, however, we get what would have been created
        self._process_and_assert_configuration_changes(
            repo_trees={REPO1: ["src/a/Foo.java"]},
            frames=[self.frame(module="a.Foo", abs_path="Foo.java")],
            platform=self.platform,
            expected_new_code_mappings=[self.code_mapping("a/", "src/a/")],
            expected_num_code_mappings=0,
        )

    def test_handles_dollar_sign_in_module(self) -> None:
        # No code mapping will be stored, however, we get what would have been created
        self._process_and_assert_configuration_changes(
            repo_trees={REPO1: ["src/com/example/foo/Bar.kt"]},
            frames=[self.frame(module="com.example.foo.Bar$InnerClass", abs_path="Bar.kt")],
            platform=self.platform,
            expected_new_code_mappings=[
                self.code_mapping("com/example/foo/", "src/com/example/foo/")
            ],
            expected_num_code_mappings=0,
        )
