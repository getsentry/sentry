import pytest
from rest_framework.response import Response

from sentry.integrations.github.utils import (
    get_last_page_number,
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


@pytest.mark.parametrize(
    "link,expected",
    [
        # Multi-page offset pagination advertises the last page.
        (
            '<https://api.github.com/installation/repositories?per_page=100&page=2>; rel="next", '
            '<https://api.github.com/installation/repositories?per_page=100&page=9>; rel="last"',
            9,
        ),
        # Single page: no link header at all.
        (None, None),
        # Cursor-based pagination: a next link but no last link.
        ('<https://api.github.com/x?per_page=100&page=2>; rel="next"', None),
        # On the final page Github only sends the first/prev relations.
        (
            '<https://api.github.com/x?per_page=100&page=1>; rel="first", '
            '<https://api.github.com/x?per_page=100&page=8>; rel="prev"',
            None,
        ),
        # Malformed last link with no page query param.
        ('<https://api.github.com/x?per_page=100>; rel="last"', None),
    ],
)
def test_get_last_page_number(link: str | None, expected: int | None) -> None:
    response = Response(headers={"link": link} if link is not None else {})
    assert get_last_page_number(response) == expected


class IsGithubRateLimitSensitiveTest(TestCase):
    def test_returns_true_when_organization_slug_in_list(self) -> None:
        org = self.create_organization(slug="org-1")
        with self.options({"github-app.rate-limit-sensitive-orgs": ["org-1", "org-2"]}):
            assert is_github_rate_limit_sensitive(org.slug) is True

    def test_returns_false_when_organization_slug_not_in_list(self) -> None:
        org = self.create_organization(slug="org-3")
        with self.options({"github-app.rate-limit-sensitive-orgs": ["org-1", "org-2"]}):
            assert is_github_rate_limit_sensitive(org.slug) is False

    def test_returns_false_when_list_is_empty(self) -> None:
        org = self.create_organization(slug="org-1")
        with self.options({"github-app.rate-limit-sensitive-orgs": []}):
            assert is_github_rate_limit_sensitive(org.slug) is False
