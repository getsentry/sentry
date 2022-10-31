import os

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
    def setUp(self):
        super().setUp()
        repo = Repo("Test-Organization/foo", "master")
        self.code_mapping_helper = CodeMappingTreesHelper(
            {"sentry": RepoTree(repo, files=sentry_files)}
        )

        self.expected_code_mappings = [
            CodeMapping(repo, "sentry", "src/sentry"),
            CodeMapping(repo, "sentry_plugins", "src/sentry_plugins"),
        ]

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
            # This file matches two files in the repo and because we process it
            # before we derive
            "sentry_plugins/slack/client.py",
            "sentry/identity/oauth2.py",
        ]
        code_mappings = self.code_mapping_helper.generate_code_mappings(stacktraces)
        # Order matters, this is why we only derive one of the two code mappings
        assert code_mappings == self.expected_code_mappings
