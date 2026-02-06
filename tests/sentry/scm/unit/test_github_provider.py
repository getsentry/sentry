from typing import Any

import pytest

from sentry.integrations.github.client import GitHubReaction
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


# All provider methods with their arguments for parametrized tests
ALL_PROVIDER_METHODS: list[tuple[str, dict[str, Any]]] = [
    ("get_issue_comments", {"issue_id": "42"}),
    ("create_issue_comment", {"issue_id": "42", "body": "test"}),
    ("delete_issue_comment", {"comment_id": "101"}),
    ("get_pull_request", {"pull_request_id": "42"}),
    ("get_pull_request_comments", {"pull_request_id": "42"}),
    ("create_pull_request_comment", {"pull_request_id": "42", "body": "test"}),
    ("delete_pull_request_comment", {"comment_id": "201"}),
    ("get_comment_reactions", {"comment_id": "101"}),
    ("create_comment_reaction", {"comment_id": "101", "reaction": "+1"}),
    ("delete_comment_reaction", {"comment_id": "101", "reaction_id": "999"}),
    ("get_issue_reactions", {"issue_id": "42"}),
    ("create_issue_reaction", {"issue_id": "42", "reaction": "rocket"}),
    ("delete_issue_reaction", {"issue_id": "42", "reaction_id": "999"}),
]


@pytest.mark.parametrize(("method", "kwargs"), ALL_PROVIDER_METHODS)
def test_raises_scm_provider_exception_on_api_error(method: str, kwargs: dict[str, Any]):
    client = FakeGitHubApiClient()
    client.raise_api_error = True
    provider = GitHubProvider(client)
    repository = make_repository()

    with pytest.raises(SCMProviderException):
        getattr(provider, method)(repository, **kwargs)


class TestGitHubProviderGetIssueComments:
    def test_returns_transformed_comments(self):
        client = FakeGitHubApiClient()
        client.issue_comments = [
            make_github_comment(comment_id=101, body="First comment", user_id=1, username="user1"),
            make_github_comment(comment_id=102, body="Second comment", user_id=2, username="user2"),
        ]
        provider = GitHubProvider(client)
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
        provider = GitHubProvider(client)
        repository = make_repository()

        provider.get_issue_comments(repository, "42")

        assert ("get_issue_comments", ("test-org/test-repo", "42"), {}) in client.calls


class TestGitHubProviderCreateIssueComment:
    def test_calls_client_with_correct_args(self):
        client = FakeGitHubApiClient()
        provider = GitHubProvider(client)
        repository = make_repository()

        provider.create_issue_comment(repository, "42", "Test body")

        assert (
            "create_comment",
            ("test-org/test-repo", "42", {"body": "Test body"}),
            {},
        ) in client.calls


class TestGitHubProviderDeleteIssueComment:
    def test_calls_client_with_correct_args(self):
        client = FakeGitHubApiClient()
        provider = GitHubProvider(client)
        repository = make_repository()

        provider.delete_issue_comment(repository, "101")

        assert (
            "delete_issue_comment",
            ("test-org/test-repo", "101"),
            {},
        ) in client.calls


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
        provider = GitHubProvider(client)
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
        provider = GitHubProvider(client)
        repository = make_repository()

        pr = provider.get_pull_request(repository, "42")

        assert pr["description"] is None

    def test_raises_key_error_on_malformed_response(self):
        client = FakeGitHubApiClient()
        client.pull_request_data = {"id": 1, "title": "test"}
        provider = GitHubProvider(client)
        repository = make_repository()

        with pytest.raises(KeyError):
            provider.get_pull_request(repository, "42")


class TestGitHubProviderGetPullRequestComments:
    def test_returns_transformed_comments(self):
        client = FakeGitHubApiClient()
        client.pull_request_comments = [
            make_github_comment(comment_id=201, body="PR comment"),
        ]
        provider = GitHubProvider(client)
        repository = make_repository()

        comments = provider.get_pull_request_comments(repository, "42")

        assert len(comments) == 1
        assert comments[0]["id"] == "201"
        assert comments[0]["body"] == "PR comment"


class TestGitHubProviderCreatePullRequestComment:
    def test_calls_client_with_correct_args(self):
        client = FakeGitHubApiClient()
        provider = GitHubProvider(client)
        repository = make_repository()

        provider.create_pull_request_comment(repository, "42", "PR comment body")

        assert (
            "create_comment",
            ("test-org/test-repo", "42", {"body": "PR comment body"}),
            {},
        ) in client.calls


class TestGitHubProviderDeletePullRequestComment:
    def test_calls_client_with_correct_args(self):
        client = FakeGitHubApiClient()
        provider = GitHubProvider(client)
        repository = make_repository()

        provider.delete_pull_request_comment(repository, "201")

        assert (
            "delete_issue_comment",
            ("test-org/test-repo", "201"),
            {},
        ) in client.calls


class TestGitHubProviderGetCommentReactions:
    def test_returns_reactions_from_client(self):
        client = FakeGitHubApiClient()
        client.comment_reactions = [
            make_github_reaction(reaction_id=1, content="+1"),
            make_github_reaction(reaction_id=2, content="eyes"),
        ]
        provider = GitHubProvider(client)
        repository = make_repository()

        reactions = provider.get_comment_reactions(repository, "101")

        assert reactions == client.comment_reactions


class TestGitHubProviderCreateCommentReaction:
    def test_calls_client_with_mapped_reaction(self):
        client = FakeGitHubApiClient()
        provider = GitHubProvider(client)
        repository = make_repository()

        provider.create_comment_reaction(repository, "101", "+1")

        assert (
            "create_comment_reaction",
            ("test-org/test-repo", "101", GitHubReaction.PLUS_ONE),
            {},
        ) in client.calls


class TestGitHubProviderDeleteCommentReaction:
    def test_calls_client_with_correct_path(self):
        client = FakeGitHubApiClient()
        provider = GitHubProvider(client)
        repository = make_repository()

        provider.delete_comment_reaction(repository, "101", "999")

        assert (
            "delete",
            ("/repos/test-org/test-repo/issues/comments/101/reactions/999",),
            {},
        ) in client.calls


class TestGitHubProviderGetIssueReactions:
    def test_returns_transformed_reactions(self):
        client = FakeGitHubApiClient()
        client.issue_reactions = [
            make_github_reaction(reaction_id=1, content="heart"),
            make_github_reaction(reaction_id=2, content="+1"),
        ]
        provider = GitHubProvider(client)
        repository = make_repository()

        reactions = provider.get_issue_reactions(repository, "42")

        assert reactions == ["heart", "+1"]

    def test_raises_key_error_on_malformed_response(self):
        client = FakeGitHubApiClient()
        client.issue_reactions = [{"id": 1}]
        provider = GitHubProvider(client)
        repository = make_repository()

        with pytest.raises(KeyError):
            provider.get_issue_reactions(repository, "42")


class TestGitHubProviderCreateIssueReaction:
    def test_calls_client_with_mapped_reaction(self):
        client = FakeGitHubApiClient()
        provider = GitHubProvider(client)
        repository = make_repository()

        provider.create_issue_reaction(repository, "42", "rocket")

        assert (
            "create_issue_reaction",
            ("test-org/test-repo", "42", GitHubReaction.ROCKET),
            {},
        ) in client.calls


class TestGitHubProviderDeleteIssueReaction:
    def test_calls_client_delete_issue_reaction(self):
        client = FakeGitHubApiClient()
        provider = GitHubProvider(client)
        repository = make_repository()

        provider.delete_issue_reaction(repository, "42", "999")

        assert (
            "delete_issue_reaction",
            ("test-org/test-repo", "42", "999"),
            {},
        ) in client.calls
