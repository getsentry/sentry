import pytest

from sentry.integrations.github.utils import (
    is_github_rate_limit_sensitive,
    parse_github_blob_url,
)
from sentry.testutils.cases import TestCase


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


class IsGithubRateLimitSensitiveTest(TestCase):
    def test_returns_true_when_organization_slug_in_list(self):
        org = self.create_organization(slug="org-1")
        with self.options({"github-app.rate-limit-sensitive-orgs": ["org-1", "org-2"]}):
            assert is_github_rate_limit_sensitive(org.slug) is True

    def test_returns_false_when_organization_slug_not_in_list(self):
        org = self.create_organization(slug="org-3")
        with self.options({"github-app.rate-limit-sensitive-orgs": ["org-1", "org-2"]}):
            assert is_github_rate_limit_sensitive(org.slug) is False

    def test_returns_false_when_list_is_empty(self):
        org = self.create_organization(slug="org-1")
        with self.options({"github-app.rate-limit-sensitive-orgs": []}):
            assert is_github_rate_limit_sensitive(org.slug) is False
