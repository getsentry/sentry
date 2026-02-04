from typing import cast

import pytest

from sentry.integrations.github.client import GitHubApiClient, GitHubReaction
from sentry.scm.errors import SCMProviderException
from sentry.scm.private.providers.github import GitHubProvider
from sentry.scm.types import Repository
from tests.sentry.scm.test_fixtures import (
    FakeGitHubApiClient,
    make_github_comment,
    make_github_pull_request,
    make_github_reaction,
)


def make_repository() -> Repository:
    return {
        "integration_id": 1,
        "name": "test-org/test-repo",
        "organization_id": 1,
        "status": "active",
    }


def make_provider(client: FakeGitHubApiClient) -> GitHubProvider:
    return GitHubProvider(cast(GitHubApiClient, client))


class TestGitHubProviderGetIssueComments:
    def test_returns_transformed_comments(self):
        client = FakeGitHubApiClient()
        client.issue_comments = [
            make_github_comment(comment_id=101, body="First comment", user_id=1, username="user1"),
            make_github_comment(comment_id=102, body="Second comment", user_id=2, username="user2"),
        ]
        provider = make_provider(client)
        repository = make_repository()

        comments = provider.get_issue_comments(repository, "42")

        assert len(comments) == 2
        assert comments[0]["id"] == "101"
        assert comments[0]["body"] == "First comment"
        assert comments[0]["author"]["id"] == "1"
        assert comments[0]["author"]["username"] == "user1"
        assert comments[1]["id"] == "102"

    def test_calls_client_with_correct_args(self):
        client = FakeGitHubApiClient()
        provider = make_provider(client)
        repository = make_repository()

        provider.get_issue_comments(repository, "42")

        assert ("get_issue_comments", ("test-org/test-repo", "42"), {}) in client.calls

    def test_raises_scm_provider_exception_on_api_error(self):
        client = FakeGitHubApiClient()
        client.raise_api_error = True
        provider = make_provider(client)
        repository = make_repository()

        with pytest.raises(SCMProviderException):
            provider.get_issue_comments(repository, "42")

    def test_raises_scm_provider_exception_on_missing_user(self):
        client = FakeGitHubApiClient()
        # Issue comment without the user field
        client.issue_comments = [{"id": 1, "body": "test", "created_at": "x", "updated_at": "x"}]
        provider = make_provider(client)
        repository = make_repository()

        with pytest.raises(SCMProviderException):
            provider.get_issue_comments(repository, "42")


class TestGitHubProviderCreateIssueComment:
    def test_calls_client_with_correct_args(self):
        client = FakeGitHubApiClient()
        provider = make_provider(client)
        repository = make_repository()

        provider.create_issue_comment(repository, "42", "Test body")

        assert (
            "create_comment",
            ("test-org/test-repo", "42", {"body": "Test body"}),
            {},
        ) in client.calls

    def test_raises_scm_provider_exception_on_api_error(self):
        client = FakeGitHubApiClient()
        client.raise_api_error = True
        provider = make_provider(client)
        repository = make_repository()

        with pytest.raises(SCMProviderException):
            provider.create_issue_comment(repository, "42", "Test body")


class TestGitHubProviderDeleteIssueComment:
    def test_calls_client_with_correct_path(self):
        client = FakeGitHubApiClient()
        provider = make_provider(client)
        repository = make_repository()

        provider.delete_issue_comment(repository, "101")

        assert (
            "delete",
            ("/repos/test-org/test-repo/issues/comments/101",),
            {},
        ) in client.calls

    def test_raises_scm_provider_exception_on_api_error(self):
        client = FakeGitHubApiClient()
        client.raise_api_error = True
        provider = make_provider(client)
        repository = make_repository()

        with pytest.raises(SCMProviderException):
            provider.delete_issue_comment(repository, "101")


class TestGitHubProviderGetPullRequest:
    def test_returns_transformed_pull_request(self):
        client = FakeGitHubApiClient()
        client.pull_request_data = make_github_pull_request(
            pr_id=42,
            title="Fix bug",
            body="This fixes the bug",
            head_sha="abc123",
            base_sha="def456",
            head_ref="fix-branch",
            base_ref="main",
            user_id=99,
            username="developer",
        )
        provider = make_provider(client)
        repository = make_repository()

        pr = provider.get_pull_request(repository, "42")

        assert pr["id"] == "42"
        assert pr["title"] == "Fix bug"
        assert pr["description"] == "This fixes the bug"
        assert pr["head"]["name"] == "fix-branch"
        assert pr["head"]["sha"] == "abc123"
        assert pr["base"]["name"] == "main"
        assert pr["base"]["sha"] == "def456"
        assert pr["author"]["id"] == "99"
        assert pr["author"]["username"] == "developer"

    def test_handles_null_body(self):
        client = FakeGitHubApiClient()
        client.pull_request_data = make_github_pull_request(body=None)
        provider = make_provider(client)
        repository = make_repository()

        pr = provider.get_pull_request(repository, "42")

        assert pr["description"] is None

    def test_raises_scm_provider_exception_on_api_error(self):
        client = FakeGitHubApiClient()
        client.raise_api_error = True
        provider = make_provider(client)
        repository = make_repository()

        with pytest.raises(SCMProviderException):
            provider.get_pull_request(repository, "42")

    def test_raises_scm_provider_exception_on_malformed_response(self):
        client = FakeGitHubApiClient()
        client.pull_request_data = {"id": 1, "title": "test"}
        provider = make_provider(client)
        repository = make_repository()

        with pytest.raises(SCMProviderException):
            provider.get_pull_request(repository, "42")


class TestGitHubProviderGetPullRequestComments:
    def test_returns_transformed_comments(self):
        client = FakeGitHubApiClient()
        client.pull_request_comments = [
            make_github_comment(comment_id=201, body="PR comment"),
        ]
        provider = make_provider(client)
        repository = make_repository()

        comments = provider.get_pull_request_comments(repository, "42")

        assert len(comments) == 1
        assert comments[0]["id"] == "201"
        assert comments[0]["body"] == "PR comment"

    def test_raises_scm_provider_exception_on_api_error(self):
        client = FakeGitHubApiClient()
        client.raise_api_error = True
        provider = make_provider(client)
        repository = make_repository()

        with pytest.raises(SCMProviderException):
            provider.get_pull_request_comments(repository, "42")


class TestGitHubProviderCreatePullRequestComment:
    def test_calls_client_with_correct_args(self):
        client = FakeGitHubApiClient()
        provider = make_provider(client)
        repository = make_repository()

        provider.create_pull_request_comment(repository, "42", "PR comment body")

        assert (
            "create_comment",
            ("test-org/test-repo", "42", {"body": "PR comment body"}),
            {},
        ) in client.calls

    def test_raises_scm_provider_exception_on_api_error(self):
        client = FakeGitHubApiClient()
        client.raise_api_error = True
        provider = make_provider(client)
        repository = make_repository()

        with pytest.raises(SCMProviderException):
            provider.create_pull_request_comment(repository, "42", "body")


class TestGitHubProviderDeletePullRequestComment:
    def test_calls_client_with_correct_path(self):
        client = FakeGitHubApiClient()
        provider = make_provider(client)
        repository = make_repository()

        provider.delete_pull_request_comment(repository, "201")

        assert (
            "delete",
            ("/repos/test-org/test-repo/issues/comments/201",),
            {},
        ) in client.calls

    def test_raises_scm_provider_exception_on_api_error(self):
        client = FakeGitHubApiClient()
        client.raise_api_error = True
        provider = make_provider(client)
        repository = make_repository()

        with pytest.raises(SCMProviderException):
            provider.delete_pull_request_comment(repository, "201")


class TestGitHubProviderGetCommentReactions:
    def test_returns_reactions_from_client(self):
        client = FakeGitHubApiClient()
        client.comment_reactions = [
            make_github_reaction(reaction_id=1, content="+1"),
            make_github_reaction(reaction_id=2, content="eyes"),
        ]
        provider = make_provider(client)
        repository = make_repository()

        reactions = provider.get_comment_reactions(repository, "101")

        assert reactions == client.comment_reactions

    def test_raises_scm_provider_exception_on_api_error(self):
        client = FakeGitHubApiClient()
        client.raise_api_error = True
        provider = make_provider(client)
        repository = make_repository()

        with pytest.raises(SCMProviderException):
            provider.get_comment_reactions(repository, "101")


class TestGitHubProviderCreateCommentReaction:
    def test_calls_client_with_mapped_reaction(self):
        client = FakeGitHubApiClient()
        provider = make_provider(client)
        repository = make_repository()

        provider.create_comment_reaction(repository, "101", "+1")

        assert (
            "create_comment_reaction",
            ("test-org/test-repo", "101", GitHubReaction.PLUS_ONE),
            {},
        ) in client.calls

    def test_raises_scm_provider_exception_on_api_error(self):
        client = FakeGitHubApiClient()
        client.raise_api_error = True
        provider = make_provider(client)
        repository = make_repository()

        with pytest.raises(SCMProviderException):
            provider.create_comment_reaction(repository, "101", "eyes")

    def test_raises_scm_provider_exception_on_invalid_reaction(self):
        client = FakeGitHubApiClient()
        provider = make_provider(client)
        repository = make_repository()

        with pytest.raises(SCMProviderException):
            provider.create_comment_reaction(repository, "101", "invalid_reaction")


class TestGitHubProviderDeleteCommentReaction:
    def test_calls_client_with_correct_path(self):
        client = FakeGitHubApiClient()
        provider = make_provider(client)
        repository = make_repository()

        provider.delete_comment_reaction(repository, "101", "999")

        assert (
            "delete",
            ("/repos/test-org/test-repo/issues/comments/101/reactions/999",),
            {},
        ) in client.calls

    def test_raises_scm_provider_exception_on_api_error(self):
        client = FakeGitHubApiClient()
        client.raise_api_error = True
        provider = make_provider(client)
        repository = make_repository()

        with pytest.raises(SCMProviderException):
            provider.delete_comment_reaction(repository, "101", "999")


class TestGitHubProviderGetIssueReactions:
    def test_returns_reactions_from_client(self):
        client = FakeGitHubApiClient()
        client.issue_reactions = [
            make_github_reaction(reaction_id=1, content="heart"),
        ]
        provider = make_provider(client)
        repository = make_repository()

        reactions = provider.get_issue_reactions(repository, "42")

        assert reactions == client.issue_reactions

    def test_raises_scm_provider_exception_on_api_error(self):
        client = FakeGitHubApiClient()
        client.raise_api_error = True
        provider = make_provider(client)
        repository = make_repository()

        with pytest.raises(SCMProviderException):
            provider.get_issue_reactions(repository, "42")


class TestGitHubProviderCreateIssueReaction:
    def test_calls_client_with_mapped_reaction(self):
        client = FakeGitHubApiClient()
        provider = make_provider(client)
        repository = make_repository()

        provider.create_issue_reaction(repository, "42", "rocket")

        assert (
            "create_issue_reaction",
            ("test-org/test-repo", "42", GitHubReaction.ROCKET),
            {},
        ) in client.calls

    def test_raises_scm_provider_exception_on_invalid_reaction(self):
        client = FakeGitHubApiClient()
        provider = make_provider(client)
        repository = make_repository()

        with pytest.raises(SCMProviderException):
            provider.create_issue_reaction(repository, "42", "not_a_reaction")


class TestGitHubProviderDeleteIssueReaction:
    def test_calls_client_delete_issue_reaction(self):
        client = FakeGitHubApiClient()
        provider = make_provider(client)
        repository = make_repository()

        provider.delete_issue_reaction(repository, "42", "999")

        assert (
            "delete_issue_reaction",
            ("test-org/test-repo", "42", "999"),
            {},
        ) in client.calls

    def test_raises_scm_provider_exception_on_api_error(self):
        client = FakeGitHubApiClient()
        client.raise_api_error = True
        provider = make_provider(client)
        repository = make_repository()

        with pytest.raises(SCMProviderException):
            provider.delete_issue_reaction(repository, "42", "999")
