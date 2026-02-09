from collections.abc import Callable
from typing import Any

import pytest

from sentry.constants import ObjectStatus
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
        "status": ObjectStatus.ACTIVE,
    }


def _make_client(**attrs: Any) -> FakeGitHubApiClient:
    """Create a FakeGitHubApiClient with the given attributes."""
    client = FakeGitHubApiClient()
    for key, value in attrs.items():
        setattr(client, key, value)
    return client


# All provider methods with their arguments for parametrized tests
ALL_PROVIDER_METHODS: list[tuple[str, dict[str, Any]]] = [
    ("get_issue_comments", {"issue_id": "42"}),
    ("create_issue_comment", {"issue_id": "42", "body": "test"}),
    ("delete_issue_comment", {"comment_id": "101"}),
    ("get_pull_request", {"pull_request_id": "42"}),
    ("get_pull_request_comments", {"pull_request_id": "42"}),
    ("create_pull_request_comment", {"pull_request_id": "42", "body": "test"}),
    ("delete_pull_request_comment", {"comment_id": "201"}),
    ("get_issue_comment_reactions", {"comment_id": "101"}),
    ("create_issue_comment_reaction", {"comment_id": "101", "reaction": "+1"}),
    ("delete_issue_comment_reaction", {"comment_id": "101", "reaction_id": "999"}),
    ("get_pull_request_comment_reactions", {"comment_id": "101"}),
    ("create_pull_request_comment_reaction", {"comment_id": "101", "reaction": "+1"}),
    ("delete_pull_request_comment_reaction", {"comment_id": "101", "reaction_id": "999"}),
    ("get_issue_reactions", {"issue_id": "42"}),
    ("create_issue_reaction", {"issue_id": "42", "reaction": "rocket"}),
    ("delete_issue_reaction", {"issue_id": "42", "reaction_id": "999"}),
    ("get_pull_request_reactions", {"pull_request_id": "42"}),
    ("create_pull_request_reaction", {"pull_request_id": "42", "reaction": "rocket"}),
    ("delete_pull_request_reaction", {"pull_request_id": "42", "reaction_id": "999"}),
    ("get_branch", {"branch": "main"}),
    ("create_branch", {"branch": "feature", "sha": "abc123"}),
    ("update_branch", {"branch": "feature", "sha": "def456"}),
]


@pytest.mark.parametrize(("method", "kwargs"), ALL_PROVIDER_METHODS)
def test_raises_scm_provider_exception_on_api_error(method: str, kwargs: dict[str, Any]):
    client = _make_client(raise_api_error=True)
    provider = GitHubProvider(client)
    repository = make_repository()

    with pytest.raises(SCMProviderException):
        getattr(provider, method)(repository, **kwargs)


CLIENT_DELEGATION_TESTS: list[
    tuple[str, dict[str, Any], tuple[str, tuple[Any, ...], dict[str, Any]]]
] = [
    (
        "get_issue_comments",
        {"issue_id": "42"},
        ("get_issue_comments", ("test-org/test-repo", "42"), {}),
    ),
    (
        "create_issue_comment",
        {"issue_id": "42", "body": "Test body"},
        ("create_comment", ("test-org/test-repo", "42", {"body": "Test body"}), {}),
    ),
    (
        "delete_issue_comment",
        {"comment_id": "101"},
        ("delete_issue_comment", ("test-org/test-repo", "101"), {}),
    ),
    (
        "create_pull_request_comment",
        {"pull_request_id": "42", "body": "PR comment body"},
        ("create_comment", ("test-org/test-repo", "42", {"body": "PR comment body"}), {}),
    ),
    (
        "delete_pull_request_comment",
        {"comment_id": "201"},
        ("delete_issue_comment", ("test-org/test-repo", "201"), {}),
    ),
    (
        "create_issue_comment_reaction",
        {"comment_id": "101", "reaction": "+1"},
        ("create_comment_reaction", ("test-org/test-repo", "101", GitHubReaction.PLUS_ONE), {}),
    ),
    (
        "delete_issue_comment_reaction",
        {"comment_id": "101", "reaction_id": "999"},
        ("delete_comment_reaction", ("test-org/test-repo", "101", "999"), {}),
    ),
    (
        "create_pull_request_comment_reaction",
        {"comment_id": "101", "reaction": "+1"},
        ("create_comment_reaction", ("test-org/test-repo", "101", GitHubReaction.PLUS_ONE), {}),
    ),
    (
        "delete_pull_request_comment_reaction",
        {"comment_id": "101", "reaction_id": "999"},
        ("delete_comment_reaction", ("test-org/test-repo", "101", "999"), {}),
    ),
    (
        "create_issue_reaction",
        {"issue_id": "42", "reaction": "rocket"},
        ("create_issue_reaction", ("test-org/test-repo", "42", GitHubReaction.ROCKET), {}),
    ),
    (
        "delete_issue_reaction",
        {"issue_id": "42", "reaction_id": "999"},
        ("delete_issue_reaction", ("test-org/test-repo", "42", "999"), {}),
    ),
    (
        "create_pull_request_reaction",
        {"pull_request_id": "42", "reaction": "rocket"},
        ("create_issue_reaction", ("test-org/test-repo", "42", GitHubReaction.ROCKET), {}),
    ),
    (
        "delete_pull_request_reaction",
        {"pull_request_id": "42", "reaction_id": "999"},
        ("delete_issue_reaction", ("test-org/test-repo", "42", "999"), {}),
    ),
    (
        "get_branch",
        {"branch": "main"},
        ("get_branch", ("test-org/test-repo", "main"), {}),
    ),
    (
        "create_branch",
        {"branch": "feature", "sha": "abc123"},
        (
            "create_git_ref",
            ("test-org/test-repo", {"ref": "refs/heads/feature", "sha": "abc123"}),
            {},
        ),
    ),
    (
        "update_branch",
        {"branch": "feature", "sha": "def456"},
        (
            "update_git_ref",
            ("test-org/test-repo", "feature", {"sha": "def456", "force": False}),
            {},
        ),
    ),
]


@pytest.mark.parametrize(("method", "kwargs", "expected_call"), CLIENT_DELEGATION_TESTS)
def test_delegates_to_correct_client_method(
    method: str,
    kwargs: dict[str, Any],
    expected_call: tuple[str, tuple[Any, ...], dict[str, Any]],
):
    client = _make_client()
    provider = GitHubProvider(client)
    repository = make_repository()

    getattr(provider, method)(repository, **kwargs)

    assert expected_call in client.calls


_ISSUE_COMMENTS_DATA = [
    make_github_comment(comment_id=101, body="First comment", user_id=1, username="user1"),
    make_github_comment(comment_id=102, body="Second comment", user_id=2, username="user2"),
]

_PR_COMMENTS_DATA = [
    make_github_comment(comment_id=201, body="PR comment"),
]

_COMMENT_REACTIONS_DATA = [
    make_github_reaction(reaction_id=1, content="+1"),
    make_github_reaction(reaction_id=2, content="eyes"),
]

_ISSUE_REACTIONS_DATA = [
    make_github_reaction(reaction_id=1, content="heart"),
    make_github_reaction(reaction_id=2, content="+1"),
]


def _check_issue_comments(result: Any) -> None:
    assert len(result) == 2
    assert result[0]["comment"]["id"] == "101"
    assert result[0]["comment"]["body"] == "First comment"
    assert result[0]["comment"]["author"] is not None
    assert result[0]["comment"]["author"]["id"] == "1"
    assert result[0]["comment"]["author"]["username"] == "user1"
    assert result[1]["comment"]["id"] == "102"


def _check_pr_comments(result: Any) -> None:
    assert len(result) == 1
    assert result[0]["comment"]["id"] == "201"
    assert result[0]["comment"]["body"] == "PR comment"


def _check_pull_request(result: Any) -> None:
    pr = result["pull_request"]
    assert pr["head"]["sha"] == "abc123"


def _check_comment_reactions(result: Any) -> None:
    assert len(result) == 2
    assert result[0]["id"] == "1"
    assert result[0]["content"] == "+1"
    assert result[0]["author"] is not None
    assert result[0]["author"]["id"] == "123"
    assert result[1]["id"] == "2"
    assert result[1]["content"] == "eyes"


def _check_get_branch(result: Any) -> None:
    assert result["git_ref"]["sha"] == "abc123def456"
    assert result["git_ref"]["ref"] is not None
    assert result["provider"] == "github"


def _check_create_branch(result: Any) -> None:
    assert result["git_ref"]["sha"] == "abc123"
    assert result["git_ref"]["ref"] == "refs/heads/feature"
    assert result["provider"] == "github"


def _check_issue_reactions(result: Any) -> None:
    assert len(result) == 2
    assert result[0]["id"] == "1"
    assert result[0]["content"] == "heart"
    assert result[0]["author"] is not None
    assert result[0]["author"]["id"] == "123"
    assert result[0]["author"]["username"] == "testuser"
    assert result[1]["id"] == "2"
    assert result[1]["content"] == "+1"


TRANSFORM_TESTS: list[tuple[str, dict[str, Any], dict[str, Any], Callable[[Any], None]]] = [
    (
        "get_issue_comments",
        {"issue_id": "42"},
        {"issue_comments": _ISSUE_COMMENTS_DATA},
        _check_issue_comments,
    ),
    (
        "get_pull_request_comments",
        {"pull_request_id": "42"},
        {"pull_request_comments": _PR_COMMENTS_DATA},
        _check_pr_comments,
    ),
    (
        "get_pull_request",
        {"pull_request_id": "42"},
        {"pull_request_data": make_github_pull_request(head_sha="abc123")},
        _check_pull_request,
    ),
    (
        "get_issue_comment_reactions",
        {"comment_id": "101"},
        {"comment_reactions": _COMMENT_REACTIONS_DATA},
        _check_comment_reactions,
    ),
    (
        "get_pull_request_comment_reactions",
        {"comment_id": "101"},
        {"comment_reactions": _COMMENT_REACTIONS_DATA},
        _check_comment_reactions,
    ),
    (
        "get_issue_reactions",
        {"issue_id": "42"},
        {"issue_reactions": _ISSUE_REACTIONS_DATA},
        _check_issue_reactions,
    ),
    (
        "get_pull_request_reactions",
        {"pull_request_id": "42"},
        {"issue_reactions": _ISSUE_REACTIONS_DATA},
        _check_issue_reactions,
    ),
    (
        "get_branch",
        {"branch": "main"},
        {},
        _check_get_branch,
    ),
    (
        "create_branch",
        {"branch": "feature", "sha": "abc123"},
        {},
        _check_create_branch,
    ),
]


@pytest.mark.parametrize(("method", "kwargs", "client_attrs", "check"), TRANSFORM_TESTS)
def test_transforms_response(
    method: str,
    kwargs: dict[str, Any],
    client_attrs: dict[str, Any],
    check: Callable[[Any], None],
):
    client = _make_client(**client_attrs)
    provider = GitHubProvider(client)
    repository = make_repository()

    result = getattr(provider, method)(repository, **kwargs)

    check(result)


# --- Edge case tests ---


class TestGetIssueCommentsEdgeCases:
    def test_returns_none_author_when_user_is_none(self):
        client = _make_client(issue_comments=[{"id": 1, "body": "ghost comment", "user": None}])
        provider = GitHubProvider(client)
        repository = make_repository()

        comments = provider.get_issue_comments(repository, "42")

        assert len(comments) == 1
        assert comments[0]["comment"]["id"] == "1"
        assert comments[0]["comment"]["body"] == "ghost comment"
        assert comments[0]["comment"]["author"] is None

    def test_returns_none_body_when_body_is_none(self):
        client = _make_client(
            issue_comments=[{"id": 1, "body": None, "user": {"id": 1, "login": "testuser"}}]
        )
        provider = GitHubProvider(client)
        repository = make_repository()

        comments = provider.get_issue_comments(repository, "42")

        assert len(comments) == 1
        assert comments[0]["comment"]["id"] == "1"
        assert comments[0]["comment"]["body"] is None
        assert comments[0]["comment"]["author"] is not None
        assert comments[0]["comment"]["author"]["username"] == "testuser"


class TestGetPullRequestEdgeCases:
    def test_raises_key_error_on_malformed_response(self):
        client = _make_client(pull_request_data={"id": 1, "title": "test"})
        provider = GitHubProvider(client)
        repository = make_repository()

        with pytest.raises(KeyError):
            provider.get_pull_request(repository, "42")


class TestGetIssueReactionsEdgeCases:
    def test_returns_none_author_when_user_is_none(self):
        client = _make_client(issue_reactions=[{"id": 1, "content": "eyes", "user": None}])
        provider = GitHubProvider(client)
        repository = make_repository()

        reactions = provider.get_issue_reactions(repository, "42")

        assert len(reactions) == 1
        assert reactions[0]["id"] == "1"
        assert reactions[0]["content"] == "eyes"
        assert reactions[0]["author"] is None

    def test_raises_key_error_on_malformed_response(self):
        client = _make_client(issue_reactions=[{"id": 1}])
        provider = GitHubProvider(client)
        repository = make_repository()

        with pytest.raises(KeyError):
            provider.get_issue_reactions(repository, "42")
