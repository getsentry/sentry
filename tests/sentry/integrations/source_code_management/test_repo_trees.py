from __future__ import annotations

from sentry.integrations.source_code_management.repo_trees import segments_are_ignored


class TestSegmentsAreIgnored:
    def test_node_modules_segment_ignored(self) -> None:
        assert segments_are_ignored(["node_modules", "react", "index.js"]) is True

    def test_nested_ignored_segment(self) -> None:
        assert segments_are_ignored(["a", "b", "vendor", "c", "util.py"]) is True

    def test_build_gradle_file_not_ignored(self) -> None:
        # "build" is an ignored *directory* segment, but "build.gradle" as a
        # single segment is not the bare string "build", so must NOT be ignored.
        assert segments_are_ignored(["build.gradle"]) is False

    def test_clean_path_not_ignored(self) -> None:
        assert segments_are_ignored(["src", "app", "main.py"]) is False

    def test_root_level_file_not_ignored(self) -> None:
        assert segments_are_ignored(["manage.py"]) is False

    def test_dist_dir_ignored(self) -> None:
        assert segments_are_ignored(["dist", "bundle.js"]) is True
