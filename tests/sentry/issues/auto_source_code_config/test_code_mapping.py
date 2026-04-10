from typing import Any
from unittest.mock import patch

import pytest

from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.source_code_management.repo_trees import (
    RepoAndBranch,
    RepoTree,
    filter_source_code_files,
    get_extension,
    should_include,
)
from sentry.issues.auto_source_code_config.code_mapping import (
    CodeMapping,
    CodeMappingTreesHelper,
    convert_stacktrace_frame_path_to_source_path,
    find_roots,
    get_sorted_code_mapping_configs,
)
from sentry.issues.auto_source_code_config.errors import (
    UnexpectedPathException,
    UnsupportedFrameInfo,
)
from sentry.issues.auto_source_code_config.frame_info import create_frame_info
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.utils.event_frames import EventFrame

SENTRY_FILES = [
    "bin/__init__.py",
    "bin/example1.py",
    "bin/example2.py",
    "docs-ui/.eslintrc.js",
    "src/sentry/identity/oauth2.py",
    "src/sentry/integrations/slack/client.py",
    "src/sentry/web/urls.py",
    "src/sentry/wsgi.py",
    "src/sentry_plugins/slack/client.py",
]


class TestRepoFiles(TestCase):
    """These evaluate which files should be included as part of a repo."""

    def test_filter_source_code_files(self) -> None:
        source_code_files = filter_source_code_files(SENTRY_FILES)

        assert source_code_files.index("bin/__init__.py") == 0
        assert source_code_files.index("docs-ui/.eslintrc.js") == 3
        with pytest.raises(ValueError):
            source_code_files.index("README.md")

    def test_filter_source_code_files_not_supported(self) -> None:
        source_code_files = filter_source_code_files([])
        assert source_code_files == []
        source_code_files = filter_source_code_files([".env", "README"])
        assert source_code_files == []

    def test_should_not_include(self) -> None:
        for file in [
            "static/app/views/organizationRoot.spec.jsx",
            "tests/foo.py",
        ]:
            assert should_include(file) is False


def test_get_extension() -> None:
    assert get_extension("") == ""
    assert get_extension("f.py") == "py"
    assert get_extension("f.xx") == "xx"
    assert get_extension("./app/utils/handleXhrErrorResponse.tsx") == "tsx"
    assert get_extension("[native code]") == ""
    assert get_extension("/foo/bar/baz") == ""
    assert get_extension("/gtm.js") == "js"


def test_buckets_logic() -> None:
    frames = [
        {"filename": "app://foo.js"},
        {"filename": "./app/utils/handleXhrErrorResponse.tsx"},
        {"filename": "getsentry/billing/tax/manager.py"},
        {"filename": "/cronscripts/monitoringsync.php"},
    ]
    helper = CodeMappingTreesHelper({})
    buckets = helper._stacktrace_buckets(frames)
    assert buckets == {
        "/cronscripts/": [create_frame_info({"filename": "/cronscripts/monitoringsync.php"})],
        "./app": [create_frame_info({"filename": "./app/utils/handleXhrErrorResponse.tsx"})],
        "app:": [create_frame_info({"filename": "app://foo.js"})],
        "getsentry": [create_frame_info({"filename": "getsentry/billing/tax/manager.py"})],
    }


class TestDerivedCodeMappings(TestCase):
    @pytest.fixture(autouse=True)
    def inject_fixtures(self, caplog: pytest.LogCaptureFixture) -> None:
        self._caplog = caplog

    def setUp(self) -> None:
        super().setUp()
        self.foo_repo = RepoAndBranch("Test-Organization/foo", "master")
        self.bar_repo = RepoAndBranch("Test-Organization/bar", "main")
        self.code_mapping_helper = CodeMappingTreesHelper(
            {
                self.foo_repo.name: RepoTree(self.foo_repo, files=SENTRY_FILES),
                self.bar_repo.name: RepoTree(self.bar_repo, files=["sentry/web/urls.py"]),
            }
        )

        self.expected_code_mappings = [
            CodeMapping(repo=self.foo_repo, stacktrace_root="sentry/", source_path="src/sentry/"),
            CodeMapping(
                repo=self.foo_repo,
                stacktrace_root="sentry_plugins/",
                source_path="src/sentry_plugins/",
            ),
        ]

    def test_package_also_matches(self) -> None:
        repo_tree = RepoTree(self.foo_repo, files=["apostello/views/base.py"])
        # We create a new tree helper in order to improve the understability of this test
        cmh = CodeMappingTreesHelper({self.foo_repo.name: repo_tree})
        cm = cmh._generate_code_mapping_from_tree(
            repo_tree=repo_tree, frame_filename=create_frame_info({"filename": "raven/base.py"})
        )
        # We should not derive a code mapping since the package name does not match
        assert cm == []

    def test_no_matches(self) -> None:
        frames = [
            {"filename": "getsentry/billing/tax/manager.py"},
            {"filename": "requests/models.py"},
            {"filename": "urllib3/connectionpool.py"},
            {"filename": "ssl.py"},
        ]
        code_mappings = self.code_mapping_helper.generate_code_mappings(frames)
        assert code_mappings == []

    @patch("sentry.issues.auto_source_code_config.code_mapping.logger")
    def test_matches_top_src_file(self, logger: Any) -> None:
        frames = [{"filename": "setup.py"}]
        code_mappings = self.code_mapping_helper.generate_code_mappings(frames)
        assert code_mappings == []

    def test_no_dir_depth_match(self) -> None:
        frames = [{"filename": "sentry/wsgi.py"}]
        code_mappings = self.code_mapping_helper.generate_code_mappings(frames)
        assert code_mappings == [
            CodeMapping(
                repo=RepoAndBranch(name="Test-Organization/foo", branch="master"),
                stacktrace_root="sentry/",
                source_path="src/sentry/",
            )
        ]

    def test_more_than_one_match_does_derive(self) -> None:
        frames = [
            # More than one file matches for this, however, the package name is taken into account
            # - "src/sentry_plugins/slack/client.py",
            # - "src/sentry/integrations/slack/client.py",
            {"filename": "sentry_plugins/slack/client.py"},
        ]
        code_mappings = self.code_mapping_helper.generate_code_mappings(frames)
        assert code_mappings == [
            CodeMapping(
                repo=self.foo_repo,
                stacktrace_root="sentry_plugins/",
                source_path="src/sentry_plugins/",
            )
        ]

    def test_no_stacktraces_to_process(self) -> None:
        code_mappings = self.code_mapping_helper.generate_code_mappings([])
        assert code_mappings == []

    def test_more_than_one_match_works_when_code_mapping_excludes_other_match(self) -> None:
        frames = [
            {"filename": "sentry/identity/oauth2.py"},
            {"filename": "sentry_plugins/slack/client.py"},
        ]
        code_mappings = self.code_mapping_helper.generate_code_mappings(frames)
        assert code_mappings == self.expected_code_mappings

    def test_more_than_one_match_works_with_different_order(self) -> None:
        frames = [
            # This file matches twice files in the repo, however, the reprocessing
            # feature allows deriving both code mappings
            {"filename": "sentry_plugins/slack/client.py"},
            {"filename": "sentry/identity/oauth2.py"},
        ]
        code_mappings = self.code_mapping_helper.generate_code_mappings(frames)
        assert sorted(code_mappings) == sorted(self.expected_code_mappings)

    @patch("sentry.issues.auto_source_code_config.code_mapping.logger")
    def test_more_than_one_repo_match(self, logger: Any) -> None:
        # XXX: There's a chance that we could infer package names but that is risky
        # repo 1: src/sentry/web/urls.py
        # repo 2: sentry/web/urls.py
        frames = [{"filename": "sentry/web/urls.py"}]
        code_mappings = self.code_mapping_helper.generate_code_mappings(frames)
        # The file appears in more than one repo, thus, we are unable to determine the code mapping
        assert code_mappings == []
        logger.warning.assert_called_with("More than one repo matched %s", "sentry/web/urls.py")

    def test_get_file_and_repo_matches_single(self) -> None:
        frame_filename = create_frame_info({"filename": "sentry_plugins/slack/client.py"})
        matches = self.code_mapping_helper.get_file_and_repo_matches(frame_filename)
        expected_matches = [
            {
                "filename": "src/sentry_plugins/slack/client.py",
                "repo_name": "Test-Organization/foo",
                "repo_branch": "master",
                "stacktrace_root": "sentry_plugins/",
                "source_path": "src/sentry_plugins/",
            }
        ]
        assert matches == expected_matches

    def test_get_file_and_repo_matches_multiple(self) -> None:
        frame_filename = create_frame_info({"filename": "sentry/web/urls.py"})
        matches = self.code_mapping_helper.get_file_and_repo_matches(frame_filename)
        expected_matches = [
            {
                "filename": "src/sentry/web/urls.py",
                "repo_name": "Test-Organization/foo",
                "repo_branch": "master",
                "stacktrace_root": "sentry/",
                "source_path": "src/sentry/",
            },
            {
                "filename": "sentry/web/urls.py",
                "repo_name": "Test-Organization/bar",
                "repo_branch": "main",
                "stacktrace_root": "",
                "source_path": "",
            },
        ]
        assert matches == expected_matches

    def test_generate_code_mappings_same_repo_multiple_java_source_roots(self) -> None:
        repo_tree = RepoTree(
            self.foo_repo,
            files=[
                "sentry-graphql/src/main/java/io/sentry/graphql/GraphQLFetcher.java",
                "sentry-graphql-core/src/main/java/io/sentry/graphql/GraphQLFetcher.java",
            ],
        )
        helper = CodeMappingTreesHelper({self.foo_repo.name: repo_tree})

        code_mappings = helper.generate_code_mappings(
            [{"module": "io.sentry.graphql.GraphQLFetcher", "abs_path": "GraphQLFetcher.java"}],
            platform="java",
        )

        assert sorted(code_mappings) == sorted(
            [
                CodeMapping(
                    repo=self.foo_repo,
                    stacktrace_root="io/sentry/graphql/",
                    source_path="sentry-graphql/src/main/java/io/sentry/graphql/",
                ),
                CodeMapping(
                    repo=self.foo_repo,
                    stacktrace_root="io/sentry/graphql/",
                    source_path="sentry-graphql-core/src/main/java/io/sentry/graphql/",
                ),
            ]
        )

    def test_generate_code_mappings_realistic_java_monorepo_layout(self) -> None:
        repo_tree = RepoTree(
            self.foo_repo,
            files=[
                "sentry-opentelemetry/sentry-opentelemetry-agent/src/main/java/io/sentry/opentelemetry/agent/AgentMain.java",
                "sentry-opentelemetry/sentry-opentelemetry-agentcustomization/src/main/java/io/sentry/opentelemetry/AgentCustomizer.java",
                "sentry-opentelemetry/sentry-opentelemetry-agentless/src/main/java/io/sentry/opentelemetry/agent/AgentlessMain.java",
                "sentry-opentelemetry/sentry-opentelemetry-agentless-spring/src/main/java/io/sentry/opentelemetry/agent/AgentlessSpringMain.java",
                "sentry-opentelemetry/sentry-opentelemetry-bootstrap/src/main/java/io/sentry/opentelemetry/BootstrapMain.java",
                "sentry-opentelemetry/sentry-opentelemetry-core/src/main/java/io/sentry/opentelemetry/CoreMain.java",
                "sentry-opentelemetry/sentry-opentelemetry-otlp/src/main/java/io/sentry/opentelemetry/otlp/OtlpMain.java",
            ],
        )
        helper = CodeMappingTreesHelper({self.foo_repo.name: repo_tree})

        code_mappings = helper.generate_code_mappings(
            [
                {"module": "io.sentry.opentelemetry.agent.AgentMain", "abs_path": "AgentMain.java"},
                {
                    "module": "io.sentry.opentelemetry.AgentCustomizer",
                    "abs_path": "AgentCustomizer.java",
                },
                {
                    "module": "io.sentry.opentelemetry.agent.AgentlessMain",
                    "abs_path": "AgentlessMain.java",
                },
                {
                    "module": "io.sentry.opentelemetry.agent.AgentlessSpringMain",
                    "abs_path": "AgentlessSpringMain.java",
                },
                {
                    "module": "io.sentry.opentelemetry.BootstrapMain",
                    "abs_path": "BootstrapMain.java",
                },
                {"module": "io.sentry.opentelemetry.CoreMain", "abs_path": "CoreMain.java"},
                {"module": "io.sentry.opentelemetry.otlp.OtlpMain", "abs_path": "OtlpMain.java"},
            ],
            platform="java",
        )

        assert sorted(code_mappings) == sorted(
            [
                CodeMapping(
                    repo=self.foo_repo,
                    stacktrace_root="io/sentry/opentelemetry/agent/",
                    source_path="sentry-opentelemetry/sentry-opentelemetry-agent/src/main/java/io/sentry/opentelemetry/agent/",
                ),
                CodeMapping(
                    repo=self.foo_repo,
                    stacktrace_root="io/sentry/opentelemetry/",
                    source_path="sentry-opentelemetry/sentry-opentelemetry-agentcustomization/src/main/java/io/sentry/opentelemetry/",
                ),
                CodeMapping(
                    repo=self.foo_repo,
                    stacktrace_root="io/sentry/opentelemetry/agent/",
                    source_path="sentry-opentelemetry/sentry-opentelemetry-agentless/src/main/java/io/sentry/opentelemetry/agent/",
                ),
                CodeMapping(
                    repo=self.foo_repo,
                    stacktrace_root="io/sentry/opentelemetry/agent/",
                    source_path="sentry-opentelemetry/sentry-opentelemetry-agentless-spring/src/main/java/io/sentry/opentelemetry/agent/",
                ),
                CodeMapping(
                    repo=self.foo_repo,
                    stacktrace_root="io/sentry/opentelemetry/",
                    source_path="sentry-opentelemetry/sentry-opentelemetry-bootstrap/src/main/java/io/sentry/opentelemetry/",
                ),
                CodeMapping(
                    repo=self.foo_repo,
                    stacktrace_root="io/sentry/opentelemetry/",
                    source_path="sentry-opentelemetry/sentry-opentelemetry-core/src/main/java/io/sentry/opentelemetry/",
                ),
                CodeMapping(
                    repo=self.foo_repo,
                    stacktrace_root="io/sentry/opentelemetry/otlp/",
                    source_path="sentry-opentelemetry/sentry-opentelemetry-otlp/src/main/java/io/sentry/opentelemetry/otlp/",
                ),
            ]
        )

    def test_multiple_matches_with_java_source_markers_do_not_enable_path_based_frames(
        self,
    ) -> None:
        repo_tree = RepoTree(
            self.foo_repo,
            files=[
                "module-a/src/main/java/foo/bar.py",
                "module-b/src/main/java/foo/bar.py",
            ],
        )
        helper = CodeMappingTreesHelper({self.foo_repo.name: repo_tree})

        code_mappings = helper.generate_code_mappings([{"filename": "foo/bar.py"}])

        assert code_mappings == []

    def test_find_roots_starts_with_period_slash(self) -> None:
        stacktrace_root, source_path = find_roots(
            create_frame_info({"filename": "./app/foo.tsx"}), "static/app/foo.tsx"
        )
        assert stacktrace_root == "./"
        assert source_path == "static/"

    def test_find_roots_starts_with_period_slash_no_containing_directory(self) -> None:
        stacktrace_root, source_path = find_roots(
            create_frame_info({"filename": "./app/foo.tsx"}), "app/foo.tsx"
        )
        assert stacktrace_root == "./"
        assert source_path == ""

    def test_find_roots_not_matching(self) -> None:
        stacktrace_root, source_path = find_roots(
            create_frame_info({"filename": "sentry/foo.py"}), "src/sentry/foo.py"
        )
        assert stacktrace_root == "sentry/"
        assert source_path == "src/sentry/"

    def test_find_roots_equal(self) -> None:
        stacktrace_root, source_path = find_roots(
            create_frame_info({"filename": "source/foo.py"}), "source/foo.py"
        )
        assert stacktrace_root == ""
        assert source_path == ""

    def test_find_roots_starts_with_period_slash_two_levels(self) -> None:
        stacktrace_root, source_path = find_roots(
            create_frame_info({"filename": "./app/foo.tsx"}), "app/foo/app/foo.tsx"
        )
        assert stacktrace_root == "./"
        assert source_path == "app/foo/"

    def test_find_roots_starts_with_app(self) -> None:
        stacktrace_root, source_path = find_roots(
            create_frame_info({"filename": "app:///utils/foo.tsx"}), "utils/foo.tsx"
        )
        assert stacktrace_root == "app:///"
        assert source_path == ""

    def test_find_roots_starts_with_multiple_dot_dot_slash(self) -> None:
        stacktrace_root, source_path = find_roots(
            create_frame_info({"filename": "../../../../../../packages/foo.tsx"}),
            "packages/foo.tsx",
        )
        assert stacktrace_root == "../../../../../../"
        assert source_path == ""

    def test_find_roots_starts_with_app_dot_dot_slash(self) -> None:
        stacktrace_root, source_path = find_roots(
            create_frame_info({"filename": "app:///../services/foo.tsx"}),
            "services/foo.tsx",
        )
        assert stacktrace_root == "app:///../"
        assert source_path == ""

    def test_find_roots_bad_stack_path(self) -> None:
        with pytest.raises(UnsupportedFrameInfo):
            create_frame_info({"filename": "https://yrurlsinyourstackpath.com/"})

    def test_find_roots_bad_source_path(self) -> None:
        with pytest.raises(UnexpectedPathException):
            find_roots(
                create_frame_info({"filename": "sentry/random.py"}),
                "nothing/something.js",
            )

    def test_find_roots_empty_source_path(self) -> None:
        with pytest.raises(UnexpectedPathException):
            find_roots(
                create_frame_info({"filename": "sentry/foo.py"}),
                "",
            )

    def test_find_roots_windows_path_with_spaces(self) -> None:
        stacktrace_root, source_path = find_roots(
            create_frame_info({"filename": "C:\\Program Files\\MyApp\\src\\file.py"}), "src/file.py"
        )
        assert stacktrace_root == "C:\\Program Files\\MyApp\\"
        assert source_path == ""

    def test_find_roots_windows_path_with_spaces_nested(self) -> None:
        stacktrace_root, source_path = find_roots(
            create_frame_info(
                {"filename": "C:\\Program Files\\My Company\\My App\\src\\main\\file.py"}
            ),
            "src/main/file.py",
        )
        assert stacktrace_root == "C:\\Program Files\\My Company\\My App\\"
        assert source_path == ""

    def test_find_roots_windows_path_with_spaces_source_match(self) -> None:
        stacktrace_root, source_path = find_roots(
            create_frame_info({"filename": "C:\\Program Files\\MyApp\\src\\components\\file.py"}),
            "frontend/src/components/file.py",
        )
        assert stacktrace_root == "C:\\Program Files\\MyApp\\"
        assert source_path == "frontend/"


class TestFindRootsJavaSourceRootMarkers(TestCase):
    """Tests for find_roots detecting Gradle-style Java/Kotlin source roots."""

    def test_find_roots_java_source_root(self) -> None:
        frame = create_frame_info(
            {"module": "io.sentry.android.core.SentryAndroid", "abs_path": "SentryAndroid.java"},
            "java",
        )
        stack_root, source_root = find_roots(
            frame,
            "sentry-android-core/src/main/java/io/sentry/android/core/SentryAndroid.java",
            [
                "sentry-android-core/src/main/java/io/sentry/android/core/SentryAndroid.java",
                "sentry-android-core/src/main/java/io/sentry/android/core/SentryFrameMetrics.java",
            ],
        )
        assert stack_root == "io/sentry/android/core/"
        assert source_root == "sentry-android-core/src/main/java/io/sentry/android/core/"

    def test_find_roots_java_deep_module(self) -> None:
        frame = create_frame_info(
            {
                "module": "io.sentry.spring.boot.jakarta.SentryAutoConfiguration",
                "abs_path": "SentryAutoConfiguration.java",
            },
            "java",
        )
        stack_root, source_root = find_roots(
            frame,
            "sentry-spring-boot-jakarta/src/main/java/io/sentry/spring/boot/jakarta/SentryAutoConfiguration.java",
            [
                "sentry-spring-boot-jakarta/src/main/java/io/sentry/spring/boot/jakarta/SentryAutoConfiguration.java",
                "sentry-spring-boot-jakarta/src/main/java/io/sentry/spring/boot/jakarta/SentryWebFilter.java",
            ],
        )
        assert stack_root == "io/sentry/spring/boot/jakarta/"
        assert (
            source_root == "sentry-spring-boot-jakarta/src/main/java/io/sentry/spring/boot/jakarta/"
        )

    def test_find_roots_kotlin_source_root(self) -> None:
        frame = create_frame_info(
            {"module": "io.sentry.test.TestHelper", "abs_path": "TestHelper.kt"},
            "java",
        )
        stack_root, source_root = find_roots(
            frame,
            "sentry-test-support/src/main/kotlin/io/sentry/test/TestHelper.kt",
            [
                "sentry-test-support/src/main/kotlin/io/sentry/TestLogger.kt",
                "sentry-test-support/src/main/kotlin/io/sentry/test/TestHelper.kt",
            ],
        )
        assert stack_root == "io/sentry/"
        assert source_root == "sentry-test-support/src/main/kotlin/io/sentry/"

    def test_find_roots_no_marker_falls_back(self) -> None:
        frame = create_frame_info(
            {"module": "io.sentry.android.core.SentryAndroid", "abs_path": "SentryAndroid.java"},
            "java",
        )
        stack_root, source_root = find_roots(
            frame,
            "src/io/sentry/android/core/SentryAndroid.java",
        )
        # Falls back to frame_filename.stack_root which is "io/sentry/android/core/"
        assert stack_root == "io/sentry/android/core/"
        assert source_root == "src/io/sentry/android/core/"

    def test_find_roots_non_java_source_root_marker_uses_generic_fallback(self) -> None:
        frame = create_frame_info({"filename": "foo/bar.py"})
        stack_root, source_root = find_roots(
            frame,
            "pkg/src/main/java/foo/bar.py",
            ["pkg/src/main/java/foo/bar.py"],
        )
        assert stack_root == "foo/"
        assert source_root == "pkg/src/main/java/foo/"

    def test_find_roots_java_generates_correct_code_mapping(self) -> None:
        frame = create_frame_info(
            {
                "module": "io.sentry.spring.boot.jakarta.SentryAutoConfiguration",
                "abs_path": "SentryAutoConfiguration.java",
            },
            "java",
        )
        stack_root, source_root = find_roots(
            frame,
            "sentry-spring-boot-jakarta/src/main/java/io/sentry/spring/boot/jakarta/SentryAutoConfiguration.java",
            [
                "sentry-spring-boot-jakarta/src/main/java/io/sentry/spring/boot/jakarta/SentryAutoConfiguration.java",
                "sentry-spring-boot-jakarta/src/main/java/io/sentry/spring/boot/jakarta/SentryWebFilter.java",
            ],
        )
        assert (
            frame.raw_path.replace(stack_root, source_root, 1)
            == "sentry-spring-boot-jakarta/src/main/java/io/sentry/spring/boot/jakarta/SentryAutoConfiguration.java"
        )


class TestConvertStacktraceFramePathToSourcePath(TestCase):
    def setUp(self) -> None:
        super()
        self.integration, self.oi = self.create_provider_integration_for(
            self.organization, self.user, provider="example", name="Example"
        )

        self.repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
        )

        self.code_mapping_empty = self.create_code_mapping(
            organization_integration=self.oi,
            project=self.project,
            repo=self.repo,
            stack_root="",
            source_root="src/",
        )
        self.code_mapping_abs_path = self.create_code_mapping(
            organization_integration=self.oi,
            project=self.project,
            repo=self.repo,
            stack_root="/Users/Foo/src/sentry/",
            source_root="src/sentry/",
        )
        self.code_mapping_file = self.create_code_mapping(
            organization_integration=self.oi,
            project=self.project,
            repo=self.repo,
            stack_root="sentry/",
            source_root="src/sentry/",
        )
        self.code_mapping_backslash = self.create_code_mapping(
            organization_integration=self.oi,
            project=self.project,
            repo=self.repo,
            stack_root="C:\\Users\\Foo\\",
            source_root="/",
        )

    def test_convert_stacktrace_frame_path_to_source_path_empty(self) -> None:
        assert (
            convert_stacktrace_frame_path_to_source_path(
                frame=EventFrame(filename="sentry/file.py"),
                code_mapping=self.code_mapping_empty,
                platform="python",
                sdk_name="sentry.python",
            )
            == "src/sentry/file.py"
        )

    def test_convert_stacktrace_frame_path_to_source_path_abs_path(self) -> None:
        assert (
            convert_stacktrace_frame_path_to_source_path(
                frame=EventFrame(
                    filename="file.py", abs_path="/Users/Foo/src/sentry/folder/file.py"
                ),
                code_mapping=self.code_mapping_abs_path,
                platform="python",
                sdk_name="sentry.python",
            )
            == "src/sentry/folder/file.py"
        )

    def test_convert_stacktrace_frame_path_to_source_path_java(self) -> None:
        assert (
            convert_stacktrace_frame_path_to_source_path(
                frame=EventFrame(
                    filename="File.java",
                    module="sentry.module.File",
                    abs_path="File.java",
                ),
                code_mapping=self.code_mapping_file,
                platform="java",
                sdk_name="sentry.java",
            )
            == "src/sentry/module/File.java"
        )

    def test_convert_stacktrace_frame_path_to_source_path_java_no_source_context(self) -> None:
        code_mapping = self.create_code_mapping(
            organization_integration=self.oi,
            project=self.project,
            repo=self.repo,
            stack_root="com/example/",
            source_root="src/com/example/",
            automatically_generated=False,
        )
        for module, abs_path, expected_path in [
            (
                "com.example.vu.android.MainActivity",
                "MainActivity.java",
                "src/com/example/vu/android/MainActivity.java",
            ),
            (
                "com.example.vu.android.MainActivity$$ExternalSyntheticLambda4",
                "D8$$SyntheticClass",
                # Extension not appended since abs_path did not contain one
                "src/com/example/vu/android/MainActivity",
            ),
            (
                "com.example.vu.android.empowerplant.MainFragment$3$1",
                "MainFragment.java",
                "src/com/example/vu/android/empowerplant/MainFragment.java",
            ),
            (
                "com.example.foo.BarImpl$invoke$bazFetch$2",
                "Bar.kt",  # Notice "Impl" is not included in the module above
                "src/com/example/foo/Bar.kt",
            ),
        ]:
            assert (
                convert_stacktrace_frame_path_to_source_path(
                    frame=EventFrame(filename=abs_path, abs_path=abs_path, module=module),
                    code_mapping=code_mapping,
                    platform="java",
                    sdk_name="sentry.java.android",
                )
                == expected_path
            )

    def test_convert_stacktrace_frame_path_to_source_path_backslashes(self) -> None:
        assert (
            convert_stacktrace_frame_path_to_source_path(
                EventFrame(
                    filename="file.rs", abs_path="C:\\Users\\Foo\\src\\sentry\\folder\\file.rs"
                ),
                code_mapping=self.code_mapping_backslash,
                platform="rust",
                sdk_name="sentry.rust",
            )
            == "src/sentry/folder/file.rs"
        )


class TestGetSortedCodeMappingConfigs(TestCase):
    def setUp(self) -> None:
        super()
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = self.create_provider_integration(provider="example", name="Example")
            self.integration.add_organization(self.organization, self.user)
            self.oi = OrganizationIntegration.objects.get(integration_id=self.integration.id)

        self.repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
        )
        self.repo.integration_id = self.integration.id
        self.repo.provider = "example"
        self.repo.save()

    def test_get_sorted_code_mapping_configs(self) -> None:
        # Created by the user, not well defined stack root
        code_mapping1 = self.create_code_mapping(
            organization_integration=self.oi,
            project=self.project,
            repo=self.repo,
            stack_root="",
            source_root="",
            automatically_generated=False,
        )
        # Created by automation, not as well defined stack root
        code_mapping2 = self.create_code_mapping(
            organization_integration=self.oi,
            project=self.project,
            repo=self.repo,
            stack_root="usr/src/getsentry/src/",
            source_root="",
            automatically_generated=True,
        )
        # Created by the user, well defined stack root
        code_mapping3 = self.create_code_mapping(
            organization_integration=self.oi,
            project=self.project,
            repo=self.repo,
            stack_root="usr/src/getsentry/",
            source_root="",
            automatically_generated=False,
        )
        # Created by the user, not as well defined stack root
        code_mapping4 = self.create_code_mapping(
            organization_integration=self.oi,
            project=self.project,
            repo=self.repo,
            stack_root="usr/src/",
            source_root="",
            automatically_generated=False,
        )
        # Created by automation, well defined stack root
        code_mapping5 = self.create_code_mapping(
            organization_integration=self.oi,
            project=self.project,
            repo=self.repo,
            stack_root="usr/src/getsentry/src/sentry/",
            source_root="",
            automatically_generated=True,
        )
        # Created by user, well defined stack root that references abs_path
        code_mapping6 = self.create_code_mapping(
            organization_integration=self.oi,
            project=self.project,
            repo=self.repo,
            stack_root="/Users/User/code/src/getsentry/src/sentry/",
            source_root="",
            automatically_generated=False,
        )

        # Expected configs: stack_root, automatically_generated
        expected_config_order = [
            code_mapping6,  # "/Users/User/code/src/getsentry/src/sentry/", False
            code_mapping3,  # "usr/src/getsentry/", False
            code_mapping4,  # "usr/src/", False
            code_mapping1,  # "", False
            code_mapping5,  # "usr/src/getsentry/src/sentry/", True
            code_mapping2,  # "usr/src/getsentry/src/", True
        ]

        sorted_configs = get_sorted_code_mapping_configs(self.project)
        assert sorted_configs == expected_config_order
