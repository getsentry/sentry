import os

import pytest

from sentry.integrations.utils.code_mapping import (
    CodeMapping,
    CodeMappingTreesHelper,
    FrameFilename,
    Repo,
    RepoTree,
)
from sentry.testutils import TestCase
from sentry.utils import json

with open(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures/sentry_files.json")
) as fd:
    sentry_files = json.load(fd)


class TestDerivedCodeMappings(TestCase):
    @pytest.fixture(autouse=True)
    def inject_fixtures(self, caplog):
        self._caplog = caplog

    def setUp(self):
        super().setUp()
        self.foo_repo = Repo("Test-Organization/foo", "master")
        self.bar_repo = Repo("Test-Organization/bar", "main")
        self.code_mapping_helper = CodeMappingTreesHelper(
            {
                self.foo_repo.name: RepoTree(self.foo_repo, files=sentry_files),
                self.bar_repo.name: RepoTree(self.bar_repo, files=["getsentry/web/urls.py"]),
            }
        )

        self.expected_code_mappings = [
            CodeMapping(self.foo_repo, "sentry", "src/sentry"),
            CodeMapping(self.foo_repo, "sentry_plugins", "src/sentry_plugins"),
        ]

    def test_frame_filename_package_and_more_than_one_level(self):
        ff = FrameFilename("getsentry/billing/tax/manager.py")
        assert f"{ff.root}/{ff.dir_path}/{ff.file_name}" == "getsentry/billing/tax/manager.py"
        assert f"{ff.dir_path}/{ff.file_name}" == ff.file_and_dir_path

    def test_frame_filename_package_and_no_levels(self):
        ff = FrameFilename("root/bar.py")
        assert f"{ff.root}/{ff.file_name}" == "root/bar.py"
        assert f"{ff.root}/{ff.file_and_dir_path}" == "root/bar.py"
        assert ff.dir_path == ""

    def test_frame_filename_no_package(self):
        ff = FrameFilename("foo.py")
        assert ff.root == ""
        assert ff.dir_path == ""
        assert ff.file_name == "foo.py"

    def test_frame_filename_repr(self):
        path = "getsentry/billing/tax/manager.py"
        assert FrameFilename(path).__repr__() == f"FrameFilename: {path}"

    def test_buckets_logic(self):
        stacktraces = ["app://foo.js", "getsentry/billing/tax/manager.py", "ssl.py"]
        buckets = self.code_mapping_helper.stacktrace_buckets(stacktraces)
        assert buckets == {
            "NO_TOP_DIR": [FrameFilename("ssl.py")],
            "app:": [FrameFilename("app://foo.js")],
            "getsentry": [FrameFilename("getsentry/billing/tax/manager.py")],
        }

    def test_package_also_matches(self):
        # We create a new tree helper in order to improve the understability of this test
        cmh = CodeMappingTreesHelper(
            {self.foo_repo.name: RepoTree(self.foo_repo, files=["apostello/views/base.py"])}
        )
        cm = cmh._generate_code_mapping_from_tree(
            repo_full_name=self.foo_repo.name,
            frame_filename=FrameFilename("raven/base.py"),
        )
        # We should not derive a code mapping since the package name does not match
        assert cm == []

    def test_no_support_for_toplevel_files(self):
        file_name = "base.py"
        ff = FrameFilename(file_name)
        assert ff.root == ""
        assert ff.dir_path == ""
        assert ff.file_and_dir_path == file_name
        # We create a new tree helper in order to improve the understability of this test
        cmh = CodeMappingTreesHelper(
            {self.foo_repo.name: RepoTree(self.foo_repo, files=[file_name])}
        )

        # We should not derive a code mapping since we do not yet
        # support stackframes for non-packaged files
        assert cmh.generate_code_mappings([file_name]) == []

        # Make sure that we raise an error if we hit the code path
        assert not cmh._potential_match(file_name, ff)
        with pytest.raises(NotImplementedError):
            cmh._get_code_mapping_source_path(file_name, ff)

    def test_no_matches(self):
        stacktraces = [
            "getsentry/billing/tax/manager.py",
            "requests/models.py",
            "urllib3/connectionpool.py",
            "ssl.py",
        ]
        code_mappings = self.code_mapping_helper.generate_code_mappings(stacktraces)
        assert code_mappings == []

    def test_more_than_one_match_does_derive(self):
        stacktraces = [
            # More than one file matches for this, however, the package name is taken into account
            # - "src/sentry_plugins/slack/client.py",
            # - "src/sentry/integrations/slack/client.py",
            "sentry_plugins/slack/client.py",
        ]
        code_mappings = self.code_mapping_helper.generate_code_mappings(stacktraces)
        assert code_mappings == [
            CodeMapping(
                repo=self.foo_repo,
                stacktrace_root="sentry_plugins",
                source_path="src/sentry_plugins",
            )
        ]

    def test_no_stacktraces_to_process(self):
        code_mappings = self.code_mapping_helper.generate_code_mappings([])
        assert code_mappings == []

    def test_more_than_one_match_works_when_code_mapping_excludes_other_match(self):
        stacktraces = [
            "sentry/identity/oauth2.py",
            "sentry_plugins/slack/client.py",
        ]
        code_mappings = self.code_mapping_helper.generate_code_mappings(stacktraces)
        assert code_mappings == self.expected_code_mappings

    def test_more_than_one_match_works_with_different_order(self):
        stacktraces = [
            # This file matches twice files in the repo, however, the reprocessing
            # feature allows deriving both code mappings
            "sentry_plugins/slack/client.py",
            "sentry/identity/oauth2.py",
        ]
        code_mappings = self.code_mapping_helper.generate_code_mappings(stacktraces)
        assert sorted(code_mappings) == sorted(self.expected_code_mappings)

    def test_more_than_one_repo_match(self):
        # XXX: There's a chance that we could infer package names but that is risky
        # repo 1: src/sentry/web/urls.py
        # repo 2: getsentry/web/urls.py
        stacktraces = ["sentry/web/urls.py"]
        code_mappings = self.code_mapping_helper.generate_code_mappings(stacktraces)
        # The file appears in more than one repo, thus, we are unable to determine the code mapping
        assert code_mappings == []
        assert self._caplog.records[0].message == "More than one repo matched sentry/web/urls.py"
        assert self._caplog.records[0].levelname == "WARNING"
