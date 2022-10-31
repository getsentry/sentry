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
        foo_repo = Repo("Test-Organization/foo", "master")
        bar_repo = Repo("Test-Organization/bar", "main")
        self.code_mapping_helper = CodeMappingTreesHelper(
            {
                "sentry": RepoTree(foo_repo, files=sentry_files),
                "getsentry": RepoTree(bar_repo, files=["getsentry/web/urls.py"]),
            }
        )

        self.expected_code_mappings = [
            CodeMapping(foo_repo, "sentry", "src/sentry"),
            CodeMapping(foo_repo, "sentry_plugins", "src/sentry_plugins"),
        ]

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

    def test_no_matches(self):
        stacktraces = [
            "getsentry/billing/tax/manager.py",
            "requests/models.py",
            "urllib3/connectionpool.py",
            "ssl.py",
        ]
        code_mappings = self.code_mapping_helper.generate_code_mappings(stacktraces)
        assert code_mappings == []

    def test_more_than_one_match_does_not_derive(self):
        stacktraces = [
            # More than one file matches for this, thus, no stack traces will be produced
            # - "src/sentry_plugins/slack/client.py",
            # - "src/sentry/integrations/slack/client.py",
            "sentry_plugins/slack/client.py",
        ]
        code_mappings = self.code_mapping_helper.generate_code_mappings(stacktraces)
        assert code_mappings == []

    def test_more_than_one_match_works_when_code_mapping_excludes_other_match(self):
        stacktraces = [
            "sentry/identity/oauth2.py",
            # This file matches two files in the repo, however, because we first
            # derive the sentry code mapping we can exclude one of the files
            "sentry_plugins/slack/client.py",
        ]
        code_mappings = self.code_mapping_helper.generate_code_mappings(stacktraces)
        assert code_mappings == self.expected_code_mappings

    def test_more_than_one_match_works_with_different_order(self):
        # We do *not* derive sentry_plugins because we don't derive sentry first
        stacktraces = [
            # This file matches twice files in the repo, however, the reprocessing
            # feature allows deriving both code mappings
            "sentry_plugins/slack/client.py",
            "sentry/identity/oauth2.py",
        ]
        code_mappings = self.code_mapping_helper.generate_code_mappings(stacktraces)
        # Order matters, this is why we only derive one of the two code mappings
        assert code_mappings == self.expected_code_mappings

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
