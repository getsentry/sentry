from unittest.mock import patch

import pytest

from sentry.integrations.github.utils import (
    has_seer_and_ai_features_enabled_for_repo,
    parse_github_blob_url,
)
from sentry.testutils.cases import TestCase


class HasSeerAndAiFeaturesEnabledForRepoTest(TestCase):
    def setUp(self):
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            external_id="github:1",
        )
        self.repo = self.create_repo(
            project=self.project,
            provider="integrations:github",
            integration_id=self.integration.id,
        )

    @patch(
        "sentry.integrations.github.utils.get_seer_org_acknowledgement",
        return_value=False,
    )
    def test_returns_false_when_seer_not_acknowledged(self, mock_seer_ack):
        result = has_seer_and_ai_features_enabled_for_repo(self.organization, self.repo)
        assert result is False

    @patch(
        "sentry.integrations.github.utils.get_seer_org_acknowledgement",
        return_value=True,
    )
    def test_returns_false_when_no_code_mappings(self, mock_seer_ack):
        result = has_seer_and_ai_features_enabled_for_repo(self.organization, self.repo)
        assert result is False

    @patch(
        "sentry.integrations.github.utils.get_seer_org_acknowledgement",
        return_value=True,
    )
    def test_returns_false_when_ai_features_disabled(self, mock_seer_ack):
        self.create_code_mapping(project=self.project, repo=self.repo)

        result = has_seer_and_ai_features_enabled_for_repo(self.organization, self.repo)
        assert result is False

    @patch(
        "sentry.integrations.github.utils.get_seer_org_acknowledgement",
        return_value=True,
    )
    def test_returns_true_when_gen_ai_features_enabled(self, mock_seer_ack):
        self.create_code_mapping(project=self.project, repo=self.repo)

        with self.feature("organizations:gen-ai-features"):
            result = has_seer_and_ai_features_enabled_for_repo(self.organization, self.repo)
            assert result is True

    @patch(
        "sentry.integrations.github.utils.get_seer_org_acknowledgement",
        return_value=True,
    )
    def test_returns_false_when_gen_ai_features_enabled_but_hidden(self, mock_seer_ack):
        self.create_code_mapping(project=self.project, repo=self.repo)
        self.organization.update_option("sentry:hide_ai_features", True)

        with self.feature("organizations:gen-ai-features"):
            result = has_seer_and_ai_features_enabled_for_repo(self.organization, self.repo)
            assert result is False

    @patch(
        "sentry.integrations.github.utils.get_seer_org_acknowledgement",
        return_value=True,
    )
    def test_returns_true_when_ai_code_review_enabled(self, mock_seer_ack):
        self.create_code_mapping(project=self.project, repo=self.repo)
        self.organization.update_option("sentry:enable_pr_review_test_generation", True)

        result = has_seer_and_ai_features_enabled_for_repo(self.organization, self.repo)
        assert result is True


@pytest.mark.parametrize(
    "repo_url,source_url,expected_branch,expected_path",
    [
        (
            "https://github.com/owner/repo",
            "https://github.com/owner/repo/blob/main/path/to/file.py",
            "main",
            "path/to/file.py",
        ),
        (
            # Trailing slash on repo URL should be handled
            "https://github.com/owner/repo/",
            "https://github.com/owner/repo/blob/main/path/to/file.py",
            "main",
            "path/to/file.py",
        ),
        (
            # GitHub Enterprise style URL
            "https://github.example.org/org/repo",
            "https://github.example.org/org/repo/blob/master/src/app/index.ts",
            "master",
            "src/app/index.ts",
        ),
        (
            # No '/blob/' segment → not parseable
            "https://github.com/owner/repo",
            "https://github.com/owner/repo/tree/main/path/to/file.py",
            "",
            "",
        ),
    ],
)
def test_parse_github_blob_url(repo_url, source_url, expected_branch, expected_path):
    branch, path = parse_github_blob_url(repo_url, source_url)
    assert branch == expected_branch
    assert path == expected_path
