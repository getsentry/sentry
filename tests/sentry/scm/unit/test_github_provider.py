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
    make_github_check_run,
    make_github_comment,
    make_github_commit,
    make_github_commit_comparison,
    make_github_commit_file,
    make_github_file_content,
    make_github_git_blob,
    make_github_git_commit_object,
    make_github_git_tree,
    make_github_graphql_issue_comment,
    make_github_graphql_pr_comments_response,
    make_github_graphql_review_thread,
    make_github_graphql_review_thread_comment,
    make_github_pull_request,
    make_github_pull_request_commit,
    make_github_pull_request_file,
    make_github_reaction,
    make_github_review,
    make_github_review_comment,
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
    ("minimize_comment", {"comment_node_id": "IC_abc", "reason": "OUTDATED"}),
    ("resolve_review_thread", {"thread_node_id": "PRT_abc"}),
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
    ("create_git_blob", {"content": "hello", "encoding": "utf-8"}),
    ("get_file_content", {"path": "README.md"}),
    ("get_commit", {"sha": "abc123"}),
    ("get_commits", {}),
    ("compare_commits", {"start_sha": "aaa", "end_sha": "bbb"}),
    ("get_tree", {"tree_sha": "tree123"}),
    ("get_git_commit", {"sha": "abc123"}),
    ("create_git_tree", {"tree": [{"path": "f.py", "mode": "100644", "type": "blob", "sha": "x"}]}),
    ("create_git_commit", {"message": "msg", "tree_sha": "t", "parent_shas": ["p"]}),
    ("get_pull_request_files", {"pull_request_id": "42"}),
    ("get_pull_request_commits", {"pull_request_id": "42"}),
    ("get_pull_request_diff", {"pull_request_id": "42"}),
    ("get_pull_requests", {}),
    ("create_pull_request", {"title": "T", "body": "B", "head": "h", "base": "b"}),
    ("update_pull_request", {"pull_request_id": "42"}),
    ("request_review", {"pull_request_id": "42", "reviewers": ["user1"]}),
    (
        "create_review_comment",
        {
            "pull_request_id": "42",
            "body": "comment",
            "commit_sha": "abc",
            "path": "f.py",
        },
    ),
    (
        "create_review",
        {
            "pull_request_id": "42",
            "commit_sha": "abc",
            "event": "COMMENT",
            "comments": [],
        },
    ),
    ("create_check_run", {"name": "check", "head_sha": "abc"}),
    ("get_check_run", {"check_run_id": "300"}),
    ("update_check_run", {"check_run_id": "300"}),
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
    (
        "create_git_blob",
        {"content": "hello", "encoding": "utf-8"},
        (
            "create_git_blob",
            ("test-org/test-repo", {"content": "hello", "encoding": "utf-8"}),
            {},
        ),
    ),
    (
        "get_file_content",
        {"path": "README.md"},
        ("get_file_content", ("test-org/test-repo", "README.md", None), {}),
    ),
    (
        "get_file_content",
        {"path": "README.md", "ref": "main"},
        ("get_file_content", ("test-org/test-repo", "README.md", "main"), {}),
    ),
    (
        "get_commit",
        {"sha": "abc123"},
        ("get_commit", ("test-org/test-repo", "abc123"), {}),
    ),
    (
        "get_commits",
        {},
        ("get_commits", ("test-org/test-repo",), {"sha": None, "path": None}),
    ),
    (
        "get_commits",
        {"sha": "main", "path": "src/main.py"},
        ("get_commits", ("test-org/test-repo",), {"sha": "main", "path": "src/main.py"}),
    ),
    (
        "compare_commits",
        {"start_sha": "aaa", "end_sha": "bbb"},
        ("compare_commits", ("test-org/test-repo", "aaa", "bbb"), {}),
    ),
    (
        "get_tree",
        {"tree_sha": "tree123"},
        ("get_tree_full", ("test-org/test-repo", "tree123"), {"recursive": True}),
    ),
    (
        "get_git_commit",
        {"sha": "abc123"},
        ("get_git_commit", ("test-org/test-repo", "abc123"), {}),
    ),
    (
        "create_git_tree",
        {"tree": [{"path": "f.py", "mode": "100644", "type": "blob", "sha": "x"}]},
        (
            "create_git_tree",
            (
                "test-org/test-repo",
                {"tree": [{"path": "f.py", "mode": "100644", "type": "blob", "sha": "x"}]},
            ),
            {},
        ),
    ),
    (
        "create_git_commit",
        {"message": "msg", "tree_sha": "t", "parent_shas": ["p"]},
        (
            "create_git_commit",
            ("test-org/test-repo", {"message": "msg", "tree": "t", "parents": ["p"]}),
            {},
        ),
    ),
    (
        "get_pull_request_files",
        {"pull_request_id": "42"},
        ("get_pull_request_files", ("test-org/test-repo", "42"), {}),
    ),
    (
        "get_pull_request_commits",
        {"pull_request_id": "42"},
        ("get_pull_request_commits", ("test-org/test-repo", "42"), {}),
    ),
    (
        "get_pull_request_diff",
        {"pull_request_id": "42"},
        ("get_pull_request_diff", ("test-org/test-repo", "42"), {}),
    ),
    (
        "get_pull_requests",
        {},
        ("list_pull_requests", ("test-org/test-repo", "open", None), {}),
    ),
    (
        "get_pull_requests",
        {"state": "closed", "head": "org:branch"},
        ("list_pull_requests", ("test-org/test-repo", "closed", "org:branch"), {}),
    ),
    (
        "create_pull_request",
        {"title": "T", "body": "B", "head": "h", "base": "b"},
        (
            "create_pull_request",
            (
                "test-org/test-repo",
                {"title": "T", "body": "B", "head": "h", "base": "b", "draft": False},
            ),
            {},
        ),
    ),
    (
        "update_pull_request",
        {"pull_request_id": "42", "title": "New title"},
        ("update_pull_request", ("test-org/test-repo", "42", {"title": "New title"}), {}),
    ),
    (
        "request_review",
        {"pull_request_id": "42", "reviewers": ["user1"]},
        (
            "create_review_request",
            ("test-org/test-repo", "42", {"reviewers": ["user1"]}),
            {},
        ),
    ),
    (
        "create_review_comment",
        {
            "pull_request_id": "42",
            "body": "Nice!",
            "commit_sha": "abc123",
            "path": "src/main.py",
        },
        (
            "create_review_comment",
            (
                "test-org/test-repo",
                "42",
                {"body": "Nice!", "commit_id": "abc123", "path": "src/main.py"},
            ),
            {},
        ),
    ),
    (
        "create_review",
        {
            "pull_request_id": "42",
            "commit_sha": "abc123",
            "event": "COMMENT",
            "comments": [{"path": "f.py", "body": "fix"}],
        },
        (
            "create_review",
            (
                "test-org/test-repo",
                "42",
                {
                    "commit_id": "abc123",
                    "event": "COMMENT",
                    "comments": [{"path": "f.py", "body": "fix"}],
                },
            ),
            {},
        ),
    ),
    (
        "create_check_run",
        {"name": "Seer Review", "head_sha": "abc123"},
        (
            "create_check_run",
            ("test-org/test-repo", {"name": "Seer Review", "head_sha": "abc123"}),
            {},
        ),
    ),
    (
        "get_check_run",
        {"check_run_id": "300"},
        ("get_check_run", ("test-org/test-repo", "300"), {}),
    ),
    (
        "update_check_run",
        {"check_run_id": "300", "conclusion": "success"},
        (
            "update_check_run",
            ("test-org/test-repo", "300", {"conclusion": "success"}),
            {},
        ),
    ),
    (
        "get_pull_request_comments",
        {"pull_request_id": "42"},
        (
            "get_pull_request_comments_graphql",
            ("test-org", "test-repo", 42),
            {
                "comments_after": None,
                "include_comments": True,
                "review_threads_after": None,
                "include_threads": True,
            },
        ),
    ),
    (
        "minimize_comment",
        {"comment_node_id": "IC_abc", "reason": "OUTDATED"},
        ("minimize_comment", ("IC_abc", "OUTDATED"), {}),
    ),
    (
        "resolve_review_thread",
        {"thread_node_id": "PRT_abc"},
        ("resolve_review_thread", ("PRT_abc",), {}),
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


def _check_graphql_pr_comments(result: Any) -> None:
    # Default factory produces 1 issue comment + 1 review thread with 1 comment = 2 total
    assert len(result) == 2
    # First: issue comment
    assert result[0]["comment"]["id"] == "IC_abc123"
    assert result[0]["comment"]["body"] == "Test issue comment"
    assert result[0]["comment"]["author"] is not None
    assert result[0]["comment"]["author"]["username"] == "testuser"
    assert result[0]["provider"] == "github"
    assert result[0]["raw"]["comment_type"] == "issue_comment"
    # Second: review thread comment
    assert result[1]["comment"]["id"] == "PRRC_abc123"
    assert result[1]["comment"]["body"] == "Review thread comment"
    assert result[1]["comment"]["author"] is not None
    assert result[1]["comment"]["author"]["username"] == "reviewer"
    assert result[1]["provider"] == "github"
    assert result[1]["raw"]["comment_type"] == "pull_request_review_comment"
    # Thread metadata injected into raw
    assert result[1]["raw"]["thread_id"] == "PRT_abc123"
    assert result[1]["raw"]["isResolved"] is False
    assert result[1]["raw"]["isOutdated"] is False
    assert result[1]["raw"]["isCollapsed"] is False


def _check_pull_request(result: Any) -> None:
    pr = result["pull_request"]
    assert pr["id"] == 42
    assert pr["number"] == 1
    assert pr["title"] == "Test PR"
    assert pr["body"] == "PR description"
    assert pr["state"] == "open"
    assert pr["merged"] is False
    assert pr["url"] == "https://api.github.com/repos/test-org/test-repo/pulls/1"
    assert pr["html_url"] == "https://github.com/test-org/test-repo/pull/1"
    assert pr["head"]["sha"] == "abc123"
    assert pr["head"]["ref"] == "feature-branch"
    assert pr["base"]["sha"] == "def456"
    assert pr["base"]["ref"] == "main"
    assert result["provider"] == "github"


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


def _check_create_git_blob(result: Any) -> None:
    assert result["git_blob"]["sha"] == "blob123abc"
    assert result["provider"] == "github"


def _check_file_content(result: Any) -> None:
    fc = result["file_content"]
    assert fc["path"] == "README.md"
    assert fc["sha"] == "abc123"
    assert fc["content"] == "SGVsbG8gV29ybGQ="
    assert fc["encoding"] == "base64"
    assert fc["size"] == 11
    assert result["provider"] == "github"


def _check_get_commit(result: Any) -> None:
    c = result["commit"]
    assert c["sha"] == "abc123"
    assert c["message"] == "Fix bug"
    assert c["author"] is not None
    assert c["author"]["name"] == "Test User"
    assert c["author"]["email"] == "test@example.com"
    assert len(c["files"]) == 1
    assert c["files"][0]["filename"] == "src/main.py"
    assert result["provider"] == "github"


def _check_get_commits(result: Any) -> None:
    assert len(result) == 1
    assert result[0]["commit"]["sha"] == "abc123"
    assert result[0]["provider"] == "github"


def _check_compare_commits(result: Any) -> None:
    assert result["comparison"]["ahead_by"] == 3
    assert result["comparison"]["behind_by"] == 1
    assert result["provider"] == "github"


def _check_get_tree(result: Any) -> None:
    gt = result["git_tree"]
    assert len(gt["tree"]) == 1
    assert gt["tree"][0]["path"] == "src/main.py"
    assert gt["tree"][0]["type"] == "blob"
    assert gt["tree"][0]["sha"] == "abc123"
    assert gt["truncated"] is False
    assert result["provider"] == "github"


def _check_get_git_commit(result: Any) -> None:
    gc = result["git_commit"]
    assert gc["sha"] == "abc123"
    assert gc["tree"]["sha"] == "tree456"
    assert gc["message"] == "Initial commit"
    assert result["provider"] == "github"


def _check_create_git_tree(result: Any) -> None:
    gt = result["git_tree"]
    assert len(gt["tree"]) == 1
    assert gt["tree"][0]["path"] == "src/main.py"
    assert result["provider"] == "github"


def _check_create_git_commit(result: Any) -> None:
    gc = result["git_commit"]
    assert gc["sha"] == "newcommit123"
    assert gc["message"] == "msg"
    assert result["provider"] == "github"


def _check_pr_files(result: Any) -> None:
    assert len(result["files"]) == 1
    f = result["files"][0]
    assert f["filename"] == "src/main.py"
    assert f["status"] == "modified"
    assert f["patch"] is not None
    assert f["changes"] == 1
    assert f["sha"] == "file123"
    assert f["previous_filename"] is None
    assert result["provider"] == "github"


def _check_pr_commits(result: Any) -> None:
    assert len(result["commits"]) == 1
    c = result["commits"][0]
    assert c["sha"] == "commit123"
    assert c["message"] == "Fix bug"
    assert c["author"] is not None
    assert c["author"]["name"] == "Test User"
    assert c["author"]["email"] == "test@example.com"
    assert result["provider"] == "github"


def _check_pr_diff(result: Any) -> None:
    assert "diff --git" in result["diff"]
    assert result["provider"] == "github"


def _check_list_pull_requests(result: Any) -> None:
    assert len(result) == 1
    pr = result[0]["pull_request"]
    assert pr["number"] == 1
    assert pr["title"] == "Test PR"
    assert result[0]["provider"] == "github"


def _check_create_pull_request(result: Any) -> None:
    pr = result["pull_request"]
    assert pr["title"] == "New PR"
    assert pr["body"] == "PR body"
    assert result["provider"] == "github"


def _check_update_pull_request(result: Any) -> None:
    pr = result["pull_request"]
    assert pr["title"] == "Updated"
    assert result["provider"] == "github"


def _check_review_comment(result: Any) -> None:
    rc = result["review_comment"]
    assert rc["id"] == 100
    assert rc["html_url"] == "https://github.com/test-org/test-repo/pull/1#discussion_r100"
    assert rc["path"] == "src/main.py"
    assert rc["body"] == "Looks good"
    assert result["provider"] == "github"


def _check_review(result: Any) -> None:
    r = result["review"]
    assert r["id"] == 200
    assert r["html_url"] == "https://github.com/test-org/test-repo/pull/1#pullrequestreview-200"
    assert result["provider"] == "github"


def _check_check_run(result: Any) -> None:
    cr = result["check_run"]
    assert cr["id"] == 300
    assert cr["name"] == "Seer Review"
    assert cr["status"] == "completed"
    assert cr["conclusion"] == "success"
    assert cr["html_url"] == "https://github.com/test-org/test-repo/runs/300"
    assert result["provider"] == "github"


def _check_updated_check_run(result: Any) -> None:
    cr = result["check_run"]
    assert cr["id"] == 300
    assert cr["status"] == "completed"
    assert cr["conclusion"] == "failure"
    assert result["provider"] == "github"


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
        {"graphql_pr_comments_data": make_github_graphql_pr_comments_response()},
        _check_graphql_pr_comments,
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
    (
        "create_git_blob",
        {"content": "hello", "encoding": "utf-8"},
        {"git_blob_data": make_github_git_blob()},
        _check_create_git_blob,
    ),
    (
        "get_file_content",
        {"path": "README.md"},
        {"file_content_data": make_github_file_content()},
        _check_file_content,
    ),
    (
        "get_commit",
        {"sha": "abc123"},
        {"commit_data": make_github_commit(sha="abc123")},
        _check_get_commit,
    ),
    (
        "get_commits",
        {},
        {"commits_data": [make_github_commit()]},
        _check_get_commits,
    ),
    (
        "compare_commits",
        {"start_sha": "aaa", "end_sha": "bbb"},
        {"comparison_data": make_github_commit_comparison()},
        _check_compare_commits,
    ),
    (
        "get_tree",
        {"tree_sha": "tree123"},
        {"tree_full_data": make_github_git_tree()},
        _check_get_tree,
    ),
    (
        "get_git_commit",
        {"sha": "abc123"},
        {"git_commit_data": make_github_git_commit_object(sha="abc123")},
        _check_get_git_commit,
    ),
    (
        "create_git_tree",
        {"tree": [{"path": "f.py", "mode": "100644", "type": "blob", "sha": "x"}]},
        {},
        _check_create_git_tree,
    ),
    (
        "create_git_commit",
        {"message": "msg", "tree_sha": "t", "parent_shas": ["p"]},
        {"created_commit_data": make_github_git_commit_object(sha="newcommit123", message="msg")},
        _check_create_git_commit,
    ),
    (
        "get_pull_request_files",
        {"pull_request_id": "42"},
        {"pr_files_data": [make_github_pull_request_file()]},
        _check_pr_files,
    ),
    (
        "get_pull_request_commits",
        {"pull_request_id": "42"},
        {"pr_commits_data": [make_github_pull_request_commit()]},
        _check_pr_commits,
    ),
    (
        "get_pull_request_diff",
        {"pull_request_id": "42"},
        {"pr_diff_data": "diff --git a/f.py b/f.py\n-old\n+new"},
        _check_pr_diff,
    ),
    (
        "get_pull_requests",
        {},
        {"pull_requests_data": [make_github_pull_request()]},
        _check_list_pull_requests,
    ),
    (
        "create_pull_request",
        {"title": "New PR", "body": "PR body", "head": "feature", "base": "main"},
        {"created_pr_data": make_github_pull_request(title="New PR", body="PR body")},
        _check_create_pull_request,
    ),
    (
        "update_pull_request",
        {"pull_request_id": "42", "title": "Updated"},
        {"updated_pr_data": make_github_pull_request(title="Updated")},
        _check_update_pull_request,
    ),
    (
        "create_review_comment",
        {
            "pull_request_id": "42",
            "body": "Looks good",
            "commit_sha": "abc123",
            "path": "src/main.py",
        },
        {"review_comment_data": make_github_review_comment()},
        _check_review_comment,
    ),
    (
        "create_review",
        {
            "pull_request_id": "42",
            "commit_sha": "abc123",
            "event": "COMMENT",
            "comments": [],
        },
        {"review_data": make_github_review()},
        _check_review,
    ),
    (
        "create_check_run",
        {"name": "Seer Review", "head_sha": "abc123"},
        {"check_run_data": make_github_check_run()},
        _check_check_run,
    ),
    (
        "get_check_run",
        {"check_run_id": "300"},
        {"check_run_data": make_github_check_run()},
        _check_check_run,
    ),
    (
        "update_check_run",
        {"check_run_id": "300", "conclusion": "failure"},
        {"updated_check_run_data": make_github_check_run(conclusion="failure")},
        _check_updated_check_run,
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


class TestGetCommitEdgeCases:
    def test_handles_missing_author(self):
        raw = {"sha": "abc", "commit": {"message": "msg", "author": None}, "files": []}
        client = _make_client(commit_data=raw)
        provider = GitHubProvider(client)
        repository = make_repository()

        result = provider.get_commit(repository, "abc")

        assert result["commit"]["author"] is None
        assert result["commit"]["message"] == "msg"

    def test_handles_missing_files(self):
        raw = {"sha": "abc", "commit": {"message": "msg"}}
        client = _make_client(commit_data=raw)
        provider = GitHubProvider(client)
        repository = make_repository()

        result = provider.get_commit(repository, "abc")

        assert result["commit"]["files"] == []

    def test_handles_binary_file_without_patch(self):
        raw = make_github_commit(
            files=[make_github_commit_file(filename="image.png", status="added", patch=None)]
        )
        client = _make_client(commit_data=raw)
        provider = GitHubProvider(client)
        repository = make_repository()

        result = provider.get_commit(repository, "abc123")

        assert result["commit"]["files"][0]["patch"] is None


class TestGetFileContentEdgeCases:
    def test_passes_ref_to_client(self):
        client = _make_client()
        provider = GitHubProvider(client)
        repository = make_repository()

        provider.get_file_content(repository, "README.md", ref="feature-branch")

        assert (
            "get_file_content",
            ("test-org/test-repo", "README.md", "feature-branch"),
            {},
        ) in client.calls

    def test_handles_empty_content(self):
        raw = make_github_file_content(content="", encoding="", size=0)
        client = _make_client(file_content_data=raw)
        provider = GitHubProvider(client)
        repository = make_repository()

        result = provider.get_file_content(repository, "empty.txt")

        assert result["file_content"]["content"] == ""
        assert result["file_content"]["size"] == 0


class TestListPullRequestsEdgeCases:
    def test_returns_empty_list_when_no_prs(self):
        client = _make_client(pull_requests_data=[])
        provider = GitHubProvider(client)
        repository = make_repository()

        result = provider.get_pull_requests(repository)

        assert result == []


class TestCreatePullRequestEdgeCases:
    def test_passes_draft_flag(self):
        client = _make_client()
        provider = GitHubProvider(client)
        repository = make_repository()

        provider.create_pull_request(repository, "T", "B", "feature", "main", draft=True)

        assert (
            "create_pull_request",
            (
                "test-org/test-repo",
                {"title": "T", "body": "B", "head": "feature", "base": "main", "draft": True},
            ),
            {},
        ) in client.calls


class TestUpdatePullRequestEdgeCases:
    def test_only_includes_non_none_fields(self):
        client = _make_client()
        provider = GitHubProvider(client)
        repository = make_repository()

        provider.update_pull_request(repository, "42", title="New title")

        assert (
            "update_pull_request",
            ("test-org/test-repo", "42", {"title": "New title"}),
            {},
        ) in client.calls

    def test_empty_update_sends_empty_data(self):
        client = _make_client()
        provider = GitHubProvider(client)
        repository = make_repository()

        provider.update_pull_request(repository, "42")

        assert (
            "update_pull_request",
            ("test-org/test-repo", "42", {}),
            {},
        ) in client.calls


class TestPullRequestCommitEdgeCases:
    def test_handles_none_author(self):
        raw = make_github_pull_request_commit(author_login=None)
        raw["commit"]["author"] = None
        client = _make_client(pr_commits_data=[raw])
        provider = GitHubProvider(client)
        repository = make_repository()

        result = provider.get_pull_request_commits(repository, "42")

        assert len(result["commits"]) == 1
        assert result["commits"][0]["author"] is None


class TestCreateReviewCommentEdgeCases:
    def test_only_required_fields(self):
        client = _make_client()
        provider = GitHubProvider(client)
        repository = make_repository()

        provider.create_review_comment(repository, "42", "comment", "abc123", "src/main.py")

        assert (
            "create_review_comment",
            (
                "test-org/test-repo",
                "42",
                {"body": "comment", "commit_id": "abc123", "path": "src/main.py"},
            ),
            {},
        ) in client.calls

    def test_with_positioning_fields(self):
        client = _make_client()
        provider = GitHubProvider(client)
        repository = make_repository()

        provider.create_review_comment(
            repository,
            "42",
            "comment",
            "abc123",
            "src/main.py",
            line=10,
            side="RIGHT",
            start_line=5,
            start_side="RIGHT",
        )

        assert (
            "create_review_comment",
            (
                "test-org/test-repo",
                "42",
                {
                    "body": "comment",
                    "commit_id": "abc123",
                    "path": "src/main.py",
                    "line": 10,
                    "side": "RIGHT",
                    "start_line": 5,
                    "start_side": "RIGHT",
                },
            ),
            {},
        ) in client.calls


class TestCreateReviewEdgeCases:
    def test_with_empty_comments(self):
        client = _make_client()
        provider = GitHubProvider(client)
        repository = make_repository()

        provider.create_review(repository, "42", "abc123", "APPROVE", [])

        assert (
            "create_review",
            (
                "test-org/test-repo",
                "42",
                {"commit_id": "abc123", "event": "APPROVE", "comments": []},
            ),
            {},
        ) in client.calls

    def test_with_body(self):
        client = _make_client()
        provider = GitHubProvider(client)
        repository = make_repository()

        provider.create_review(repository, "42", "abc123", "COMMENT", [], body="Overall looks good")

        assert (
            "create_review",
            (
                "test-org/test-repo",
                "42",
                {
                    "commit_id": "abc123",
                    "event": "COMMENT",
                    "comments": [],
                    "body": "Overall looks good",
                },
            ),
            {},
        ) in client.calls


class TestCreateCheckRunEdgeCases:
    def test_with_output(self):
        client = _make_client()
        provider = GitHubProvider(client)
        repository = make_repository()

        provider.create_check_run(
            repository,
            "Seer Review",
            "abc123",
            status="completed",
            conclusion="success",
            output={"title": "Review", "summary": "All good"},
        )

        assert (
            "create_check_run",
            (
                "test-org/test-repo",
                {
                    "name": "Seer Review",
                    "head_sha": "abc123",
                    "status": "completed",
                    "conclusion": "success",
                    "output": {"title": "Review", "summary": "All good"},
                },
            ),
            {},
        ) in client.calls


class TestUpdateCheckRunEdgeCases:
    def test_only_conclusion(self):
        client = _make_client()
        provider = GitHubProvider(client)
        repository = make_repository()

        provider.update_check_run(repository, "300", conclusion="failure")

        assert (
            "update_check_run",
            ("test-org/test-repo", "300", {"conclusion": "failure"}),
            {},
        ) in client.calls

    def test_empty_update_sends_empty_data(self):
        client = _make_client()
        provider = GitHubProvider(client)
        repository = make_repository()

        provider.update_check_run(repository, "300")

        assert (
            "update_check_run",
            ("test-org/test-repo", "300", {}),
            {},
        ) in client.calls


class TestGetPullRequestCommentsEdgeCases:
    def test_empty_comments_and_threads(self):
        raw = make_github_graphql_pr_comments_response(issue_comments=[], review_threads=[])
        client = _make_client(graphql_pr_comments_data=raw)
        provider = GitHubProvider(client)
        repository = make_repository()

        result = provider.get_pull_request_comments(repository, "42")

        assert result == []

    def test_review_thread_comment_with_null_author(self):
        comment = make_github_graphql_review_thread_comment(author_login="ghost")
        comment["author"] = None
        thread = make_github_graphql_review_thread(comments=[comment])
        raw = make_github_graphql_pr_comments_response(issue_comments=[], review_threads=[thread])
        client = _make_client(graphql_pr_comments_data=raw)
        provider = GitHubProvider(client)
        repository = make_repository()

        result = provider.get_pull_request_comments(repository, "42")

        assert len(result) == 1
        assert result[0]["comment"]["author"] is None

    def test_review_thread_comment_with_reactions(self):
        comment = make_github_graphql_review_thread_comment(
            reactions=[{"content": "THUMBS_UP"}, {"content": "HEART"}],
            reactions_total_count=2,
        )
        thread = make_github_graphql_review_thread(comments=[comment])
        raw = make_github_graphql_pr_comments_response(issue_comments=[], review_threads=[thread])
        client = _make_client(graphql_pr_comments_data=raw)
        provider = GitHubProvider(client)
        repository = make_repository()

        result = provider.get_pull_request_comments(repository, "42")

        assert len(result) == 1
        # Reactions are preserved in the raw dict
        assert len(result[0]["raw"]["reactions"]["nodes"]) == 2
        assert result[0]["raw"]["reactions"]["nodes"][0]["content"] == "THUMBS_UP"
        assert result[0]["raw"]["reactions"]["nodes"][1]["content"] == "HEART"
        assert result[0]["raw"]["reactions"]["totalCount"] == 2

    def test_issue_comment_with_null_author(self):
        comment = make_github_graphql_issue_comment()
        comment["author"] = None
        raw = make_github_graphql_pr_comments_response(issue_comments=[comment], review_threads=[])
        client = _make_client(graphql_pr_comments_data=raw)
        provider = GitHubProvider(client)
        repository = make_repository()

        result = provider.get_pull_request_comments(repository, "42")

        assert len(result) == 1
        assert result[0]["comment"]["author"] is None

    def test_flattens_issue_comments_and_thread_comments(self):
        issue_comment = make_github_graphql_issue_comment(node_id="IC_1", body="issue comment")
        thread_comment = make_github_graphql_review_thread_comment(
            node_id="PRRC_1", body="thread comment"
        )
        thread = make_github_graphql_review_thread(comments=[thread_comment])
        raw = make_github_graphql_pr_comments_response(
            issue_comments=[issue_comment], review_threads=[thread]
        )
        client = _make_client(graphql_pr_comments_data=raw)
        provider = GitHubProvider(client)
        repository = make_repository()

        result = provider.get_pull_request_comments(repository, "42")

        assert len(result) == 2
        assert result[0]["comment"]["id"] == "IC_1"
        assert result[0]["comment"]["body"] == "issue comment"
        assert result[0]["raw"]["comment_type"] == "issue_comment"
        assert result[1]["comment"]["id"] == "PRRC_1"
        assert result[1]["comment"]["body"] == "thread comment"
        assert result[1]["raw"]["comment_type"] == "pull_request_review_comment"

    def test_thread_metadata_injected_into_raw(self):
        comment = make_github_graphql_review_thread_comment(node_id="PRRC_1")
        thread = make_github_graphql_review_thread(
            node_id="PRT_resolved",
            is_resolved=True,
            is_outdated=True,
            is_collapsed=True,
            comments=[comment],
        )
        raw = make_github_graphql_pr_comments_response(issue_comments=[], review_threads=[thread])
        client = _make_client(graphql_pr_comments_data=raw)
        provider = GitHubProvider(client)
        repository = make_repository()

        result = provider.get_pull_request_comments(repository, "42")

        assert len(result) == 1
        assert result[0]["raw"]["thread_id"] == "PRT_resolved"
        assert result[0]["raw"]["isResolved"] is True
        assert result[0]["raw"]["isOutdated"] is True
        assert result[0]["raw"]["isCollapsed"] is True

    def test_splits_owner_repo_correctly(self):
        client = _make_client()
        provider = GitHubProvider(client)
        repository = make_repository()

        provider.get_pull_request_comments(repository, "42")

        assert (
            "get_pull_request_comments_graphql",
            ("test-org", "test-repo", 42),
            {
                "comments_after": None,
                "include_comments": True,
                "review_threads_after": None,
                "include_threads": True,
            },
        ) in client.calls
