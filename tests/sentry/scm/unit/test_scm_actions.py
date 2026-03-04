from collections.abc import Callable
from contextlib import contextmanager
from typing import Any

import pytest

from sentry.scm.actions import SourceCodeManager
from sentry.scm.errors import SCMCodedError, SCMProviderException
from sentry.scm.types import PaginatedActionResult, ReactionResult, Repository
from tests.sentry.scm.test_fixtures import BaseTestProvider


@contextmanager
def raises_with_code(exc_class, code):
    with pytest.raises(exc_class) as exc_info:
        yield exc_info
    assert exc_info.value.code == code, f"Expected code {code!r}, got {exc_info.value.code!r}"


def fetch_repository(oid, rid) -> Repository:
    return {
        "integration_id": 1,
        "name": "test",
        "organization_id": 1,
        "is_active": True,
    }


ALL_ACTIONS: tuple[tuple[str, dict[str, Any]], ...] = (
    # Issue comments
    ("get_issue_comments", {"issue_id": "1"}),
    ("create_issue_comment", {"issue_id": "1", "body": "test"}),
    ("delete_issue_comment", {"issue_id": "1", "comment_id": "1"}),
    # Pull request
    ("get_pull_request", {"pull_request_id": "1"}),
    # Pull request comments
    ("get_pull_request_comments", {"pull_request_id": "1"}),
    ("create_pull_request_comment", {"pull_request_id": "1", "body": "test"}),
    ("delete_pull_request_comment", {"pull_request_id": "1", "comment_id": "1"}),
    # Issue comment reactions
    ("get_issue_comment_reactions", {"issue_id": "1", "comment_id": "1"}),
    ("create_issue_comment_reaction", {"issue_id": "1", "comment_id": "1", "reaction": "eyes"}),
    ("delete_issue_comment_reaction", {"issue_id": "1", "comment_id": "1", "reaction_id": "123"}),
    # Pull request comment reactions
    ("get_pull_request_comment_reactions", {"pull_request_id": "1", "comment_id": "1"}),
    (
        "create_pull_request_comment_reaction",
        {"pull_request_id": "1", "comment_id": "1", "reaction": "eyes"},
    ),
    (
        "delete_pull_request_comment_reaction",
        {"pull_request_id": "1", "comment_id": "1", "reaction_id": "123"},
    ),
    # Issue reactions
    ("get_issue_reactions", {"issue_id": "1"}),
    ("create_issue_reaction", {"issue_id": "1", "reaction": "eyes"}),
    ("delete_issue_reaction", {"issue_id": "1", "reaction_id": "456"}),
    # Pull request reactions
    ("get_pull_request_reactions", {"pull_request_id": "1"}),
    ("create_pull_request_reaction", {"pull_request_id": "1", "reaction": "eyes"}),
    ("delete_pull_request_reaction", {"pull_request_id": "1", "reaction_id": "456"}),
    # Branch operations
    ("get_branch", {"branch": "main"}),
    ("create_branch", {"branch": "feature", "sha": "abc123"}),
    ("update_branch", {"branch": "feature", "sha": "def456"}),
    # Git blob operations
    ("create_git_blob", {"content": "hello", "encoding": "utf-8"}),
    # File content operations
    ("get_file_content", {"path": "README.md"}),
    # Commit operations
    ("get_commit", {"sha": "abc123"}),
    ("get_commits", {}),
    ("compare_commits", {"start_sha": "aaa", "end_sha": "bbb"}),
    # Git data operations
    ("get_tree", {"tree_sha": "tree123"}),
    ("get_git_commit", {"sha": "abc123"}),
    ("create_git_tree", {"tree": [{"path": "f.py", "mode": "100644", "type": "blob", "sha": "x"}]}),
    ("create_git_commit", {"message": "msg", "tree_sha": "t", "parent_shas": ["p"]}),
    # Expanded pull request operations
    ("get_pull_request_files", {"pull_request_id": "1"}),
    ("get_pull_request_commits", {"pull_request_id": "1"}),
    ("get_pull_request_diff", {"pull_request_id": "1"}),
    ("get_pull_requests", {}),
    ("create_pull_request", {"title": "T", "body": "B", "head": "h", "base": "b"}),
    ("update_pull_request", {"pull_request_id": "1"}),
    ("request_review", {"pull_request_id": "1", "reviewers": ["user1"]}),
    # Review operations
    (
        "create_review_comment_file",
        {
            "pull_request_id": "1",
            "commit_id": "abc",
            "body": "comment",
            "path": "f.py",
            "side": "RIGHT",
        },
    ),
    (
        "create_review_comment_line",
        {
            "pull_request_id": "1",
            "commit_id": "abc",
            "body": "comment",
            "path": "f.py",
            "line": 10,
            "side": "RIGHT",
        },
    ),
    (
        "create_review_comment_multiline",
        {
            "pull_request_id": "1",
            "commit_id": "abc",
            "body": "comment",
            "path": "f.py",
            "start_line": 5,
            "start_side": "RIGHT",
            "end_line": 10,
            "end_side": "RIGHT",
        },
    ),
    (
        "create_review_comment_reply",
        {
            "pull_request_id": "1",
            "body": "comment",
            "comment_id": "123",
        },
    ),
    (
        "create_review",
        {
            "pull_request_id": "1",
            "commit_sha": "abc",
            "event": "comment",
            "comments": [],
        },
    ),
    # Check run operations
    ("create_check_run", {"name": "check", "head_sha": "abc"}),
    ("get_check_run", {"check_run_id": "300"}),
    ("update_check_run", {"check_run_id": "300"}),
    # GraphQL mutation operations
    ("minimize_comment", {"comment_node_id": "IC_abc", "reason": "OUTDATED"}),
    ("resolve_review_thread", {"thread_node_id": "PRT_abc"}),
)


@pytest.mark.parametrize(("method", "kwargs"), ALL_ACTIONS)
def test_rate_limited_action(method: str, kwargs: dict[str, Any]):
    class RateLimitedProvider(BaseTestProvider):
        def is_rate_limited(self, referrer):
            return True

    scm = SourceCodeManager(RateLimitedProvider())

    with raises_with_code(SCMCodedError, "rate_limit_exceeded"):
        getattr(scm, method)(**kwargs)


def test_repository_not_found():
    with raises_with_code(SCMCodedError, "repository_not_found"):
        SourceCodeManager.make_from_repository_id(
            organization_id=1,
            repository_id=1,
            fetch_repository=lambda _a, _b: None,
        )


def test_repository_inactive():
    with raises_with_code(SCMCodedError, "repository_inactive"):
        SourceCodeManager.make_from_repository_id(
            organization_id=1,
            repository_id=1,
            fetch_repository=lambda _a, _b: {
                "integration_id": 1,
                "name": "test",
                "organization_id": 1,
                "is_active": False,
            },
        )


def test_repository_organization_mismatch():
    with raises_with_code(SCMCodedError, "repository_organization_mismatch"):
        SourceCodeManager.make_from_repository_id(
            organization_id=2,
            repository_id=1,
            fetch_repository=fetch_repository,
        )


def make_scm():
    return SourceCodeManager(BaseTestProvider())


def _check_issue_comments(result: Any) -> None:
    assert len(result["data"]) == 1
    assert result["data"][0]["id"] == "101"
    assert result["data"][0]["body"] == "Test comment"
    assert result["data"][0]["author"]["username"] == "testuser"
    assert result["type"] == "github"


def _check_pull_request(result: Any) -> None:
    pr = result["data"]
    assert pr["id"] == "42"
    assert pr["number"] == 1
    assert pr["title"] == "Test PR"
    assert pr["head"]["sha"] == "abc123"
    assert pr["head"]["ref"] == "feature-branch"
    assert pr["base"]["sha"] == "def456"
    assert result["type"] == "github"


def _check_pull_request_comments(result: Any) -> None:
    assert len(result["data"]) == 1
    assert result["data"][0]["id"] == "201"
    assert result["data"][0]["body"] == "PR review comment"
    assert result["data"][0]["author"]["username"] == "reviewer"
    assert result["type"] == "github"


def _check_comment_reactions(result: Any) -> None:
    assert len(result["data"]) == 2
    assert result["data"][0]["id"] == "1"
    assert result["data"][0]["content"] == "+1"
    assert result["data"][1]["id"] == "2"
    assert result["data"][1]["content"] == "eyes"
    assert result["type"] == "github"


def _check_pr_comment_reactions(result: Any) -> None:
    assert len(result["data"]) == 2
    assert result["data"][0]["id"] == "3"
    assert result["data"][0]["content"] == "rocket"
    assert result["data"][1]["id"] == "4"
    assert result["data"][1]["content"] == "hooray"
    assert result["type"] == "github"


def _check_issue_reactions(result: Any) -> None:
    assert len(result["data"]) == 2
    assert result["data"][0]["id"] == "1"
    assert result["data"][0]["content"] == "+1"
    assert result["data"][0]["author"]["username"] == "testuser"
    assert result["data"][1]["id"] == "2"
    assert result["data"][1]["content"] == "heart"
    assert result["data"][1]["author"]["username"] == "otheruser"
    assert result["type"] == "github"


def _check_pr_reactions(result: Any) -> None:
    assert len(result["data"]) == 2
    assert result["data"][0]["id"] == "5"
    assert result["data"][0]["content"] == "laugh"
    assert result["data"][0]["author"]["username"] == "testuser"
    assert result["data"][1]["id"] == "6"
    assert result["data"][1]["content"] == "confused"
    assert result["data"][1]["author"]["username"] == "otheruser"
    assert result["type"] == "github"


def _check_get_branch(result: Any) -> None:
    assert result["data"]["ref"] == "refs/heads/main"
    assert result["data"]["sha"] == "abc123def456"
    assert result["type"] == "github"


def _check_create_branch(result: Any) -> None:
    assert result["data"]["ref"] == "feature"
    assert result["data"]["sha"] == "abc123"
    assert result["type"] == "github"


def _check_update_branch(result: Any) -> None:
    assert result["data"]["ref"] == "feature"
    assert result["data"]["sha"] == "def456"
    assert result["type"] == "github"


def _check_create_git_blob(result: Any) -> None:
    assert result["data"]["sha"] == "blob123abc"
    assert result["type"] == "github"


def _check_file_content(result: Any) -> None:
    fc = result["data"]
    assert fc["path"] == "README.md"
    assert fc["content"] == "SGVsbG8gV29ybGQ="
    assert fc["encoding"] == "base64"
    assert result["type"] == "github"


def _check_get_commit(result: Any) -> None:
    c = result["data"]
    assert c["id"] == "abc123"
    assert c["message"] == "Fix bug"
    assert c["author"]["name"] == "Test User"
    assert result["type"] == "github"


def _check_get_commits(result: Any) -> None:
    assert len(result["data"]) == 1
    assert result["data"][0]["id"] == "abc123"
    assert result["type"] == "github"


def _check_compare_commits(result: Any) -> None:
    assert len(result["data"]) == 1
    c = result["data"][0]
    assert c["id"] == "abc123"
    assert c["message"] == "Fix bug"
    assert result["type"] == "github"


def _check_get_tree(result: Any) -> None:
    gt = result["data"]
    assert len(gt["tree"]) == 1
    assert gt["tree"][0]["path"] == "src/main.py"
    assert gt["truncated"] is False
    assert result["type"] == "github"


def _check_get_git_commit(result: Any) -> None:
    gc = result["data"]
    assert gc["sha"] == "abc123"
    assert gc["tree"]["sha"] == "tree456"
    assert result["type"] == "github"


def _check_create_git_tree(result: Any) -> None:
    gt = result["data"]
    assert len(gt["tree"]) == 1
    assert result["type"] == "github"


def _check_create_git_commit(result: Any) -> None:
    gc = result["data"]
    assert gc["sha"] == "newcommit123"
    assert gc["message"] == "msg"
    assert result["type"] == "github"


def _check_pr_files(result: Any) -> None:
    assert len(result["data"]) == 1
    assert result["data"][0]["filename"] == "src/main.py"
    assert result["type"] == "github"


def _check_pr_commits(result: Any) -> None:
    assert len(result["data"]) == 1
    assert result["data"][0]["sha"] == "commit123"
    assert result["data"][0]["message"] == "Fix bug"
    assert result["type"] == "github"


def _check_pr_diff(result: Any) -> None:
    assert "diff --git" in result["data"]
    assert result["type"] == "github"


def _check_list_pull_requests(result: Any) -> None:
    assert len(result["data"]) == 1
    assert result["data"][0]["number"] == 1
    assert result["type"] == "github"


def _check_create_pull_request(result: Any) -> None:
    pr = result["data"]
    assert pr["title"] == "T"
    assert pr["body"] == "B"
    assert result["type"] == "github"


def _check_update_pull_request(result: Any) -> None:
    pr = result["data"]
    assert pr["title"] == "Test PR"
    assert result["type"] == "github"


def _check_none(result: Any) -> None:
    assert result is None


def _check_created_comment(result: Any) -> None:
    comment = result["data"]
    assert comment["id"] == "101"
    assert result["type"] == "github"


def _check_created_pr_comment(result: Any) -> None:
    comment = result["data"]
    assert comment["id"] == "201"
    assert result["type"] == "github"


def _check_created_reaction(result: Any) -> None:
    reaction = result["data"]
    assert reaction["id"] == "1"
    assert reaction["content"] == "eyes"
    assert result["type"] == "github"


def _check_review_comment(result: Any) -> None:
    rc = result["data"]
    assert rc["id"] == "100"
    assert rc["body"] == "comment"
    assert result["type"] == "github"


def _check_review(result: Any) -> None:
    r = result["data"]
    assert r["id"] == "200"
    assert result["type"] == "github"


def _check_create_check_run(result: Any) -> None:
    cr = result["data"]
    assert cr["name"] == "check"
    assert result["type"] == "github"


def _check_get_check_run(result: Any) -> None:
    cr = result["data"]
    assert cr["id"] == "300"
    assert cr["status"] == "completed"
    assert result["type"] == "github"


def _check_update_check_run(result: Any) -> None:
    cr = result["data"]
    assert cr["id"] == "300"
    assert result["type"] == "github"


ACTION_TESTS: tuple[tuple[Callable[..., Any], dict[str, Any], Callable[..., Any]], ...] = (
    (SourceCodeManager.get_issue_comments, {"issue_id": "1"}, _check_issue_comments),
    (
        SourceCodeManager.create_issue_comment,
        {"issue_id": "1", "body": "test"},
        _check_created_comment,
    ),
    (SourceCodeManager.delete_issue_comment, {"issue_id": "1", "comment_id": "1"}, _check_none),
    (SourceCodeManager.get_pull_request, {"pull_request_id": "1"}, _check_pull_request),
    (
        SourceCodeManager.get_pull_request_comments,
        {"pull_request_id": "1"},
        _check_pull_request_comments,
    ),
    (
        SourceCodeManager.create_pull_request_comment,
        {"pull_request_id": "1", "body": "test"},
        _check_created_pr_comment,
    ),
    (
        SourceCodeManager.delete_pull_request_comment,
        {"pull_request_id": "1", "comment_id": "1"},
        _check_none,
    ),
    (
        SourceCodeManager.get_issue_comment_reactions,
        {"issue_id": "1", "comment_id": "1"},
        _check_comment_reactions,
    ),
    (
        SourceCodeManager.create_issue_comment_reaction,
        {"issue_id": "1", "comment_id": "1", "reaction": "eyes"},
        _check_created_reaction,
    ),
    (
        SourceCodeManager.delete_issue_comment_reaction,
        {"issue_id": "1", "comment_id": "1", "reaction_id": "123"},
        _check_none,
    ),
    (
        SourceCodeManager.get_pull_request_comment_reactions,
        {"pull_request_id": "1", "comment_id": "1"},
        _check_pr_comment_reactions,
    ),
    (
        SourceCodeManager.create_pull_request_comment_reaction,
        {"pull_request_id": "1", "comment_id": "1", "reaction": "eyes"},
        _check_created_reaction,
    ),
    (
        SourceCodeManager.delete_pull_request_comment_reaction,
        {"pull_request_id": "1", "comment_id": "1", "reaction_id": "123"},
        _check_none,
    ),
    (SourceCodeManager.get_issue_reactions, {"issue_id": "1"}, _check_issue_reactions),
    (
        SourceCodeManager.create_issue_reaction,
        {"issue_id": "1", "reaction": "eyes"},
        _check_created_reaction,
    ),
    (SourceCodeManager.delete_issue_reaction, {"issue_id": "1", "reaction_id": "456"}, _check_none),
    (
        SourceCodeManager.get_pull_request_reactions,
        {"pull_request_id": "1"},
        _check_pr_reactions,
    ),
    (
        SourceCodeManager.create_pull_request_reaction,
        {"pull_request_id": "1", "reaction": "eyes"},
        _check_created_reaction,
    ),
    (
        SourceCodeManager.delete_pull_request_reaction,
        {"pull_request_id": "1", "reaction_id": "456"},
        _check_none,
    ),
    (SourceCodeManager.get_branch, {"branch": "main"}, _check_get_branch),
    (SourceCodeManager.create_branch, {"branch": "feature", "sha": "abc123"}, _check_create_branch),
    (SourceCodeManager.update_branch, {"branch": "feature", "sha": "def456"}, _check_update_branch),
    (
        SourceCodeManager.create_git_blob,
        {"content": "hello", "encoding": "utf-8"},
        _check_create_git_blob,
    ),
    (SourceCodeManager.get_file_content, {"path": "README.md"}, _check_file_content),
    (SourceCodeManager.get_commit, {"sha": "abc123"}, _check_get_commit),
    (SourceCodeManager.get_commits, {}, _check_get_commits),
    (
        SourceCodeManager.compare_commits,
        {"start_sha": "aaa", "end_sha": "bbb"},
        _check_compare_commits,
    ),
    (SourceCodeManager.get_tree, {"tree_sha": "tree123"}, _check_get_tree),
    (SourceCodeManager.get_git_commit, {"sha": "abc123"}, _check_get_git_commit),
    (
        SourceCodeManager.create_git_tree,
        {"tree": [{"path": "f.py", "mode": "100644", "type": "blob", "sha": "x"}]},
        _check_create_git_tree,
    ),
    (
        SourceCodeManager.create_git_commit,
        {"message": "msg", "tree_sha": "t", "parent_shas": ["p"]},
        _check_create_git_commit,
    ),
    (SourceCodeManager.get_pull_request_files, {"pull_request_id": "1"}, _check_pr_files),
    (SourceCodeManager.get_pull_request_commits, {"pull_request_id": "1"}, _check_pr_commits),
    (SourceCodeManager.get_pull_request_diff, {"pull_request_id": "1"}, _check_pr_diff),
    (SourceCodeManager.get_pull_requests, {}, _check_list_pull_requests),
    (
        SourceCodeManager.create_pull_request,
        {"title": "T", "body": "B", "head": "h", "base": "b"},
        _check_create_pull_request,
    ),
    (SourceCodeManager.update_pull_request, {"pull_request_id": "1"}, _check_update_pull_request),
    (
        SourceCodeManager.request_review,
        {"pull_request_id": "1", "reviewers": ["user1"]},
        _check_none,
    ),
    (
        SourceCodeManager.create_review_comment_file,
        {
            "pull_request_id": "1",
            "commit_id": "abc",
            "body": "comment",
            "path": "f.py",
            "side": "RIGHT",
        },
        _check_review_comment,
    ),
    (
        SourceCodeManager.create_review_comment_line,
        {
            "pull_request_id": "1",
            "commit_id": "abc",
            "body": "comment",
            "path": "f.py",
            "line": 10,
            "side": "RIGHT",
        },
        _check_review_comment,
    ),
    (
        SourceCodeManager.create_review_comment_multiline,
        {
            "pull_request_id": "1",
            "commit_id": "abc",
            "body": "comment",
            "path": "f.py",
            "start_line": 5,
            "start_side": "RIGHT",
            "end_line": 10,
            "end_side": "RIGHT",
        },
        _check_review_comment,
    ),
    (
        SourceCodeManager.create_review_comment_reply,
        {
            "pull_request_id": "1",
            "body": "comment",
            "comment_id": "123",
        },
        _check_review_comment,
    ),
    (
        SourceCodeManager.create_review,
        {
            "pull_request_id": "1",
            "commit_sha": "abc",
            "event": "comment",
            "comments": [],
        },
        _check_review,
    ),
    (
        SourceCodeManager.create_check_run,
        {"name": "check", "head_sha": "abc"},
        _check_create_check_run,
    ),
    (
        SourceCodeManager.get_check_run,
        {"check_run_id": "300"},
        _check_get_check_run,
    ),
    (
        SourceCodeManager.update_check_run,
        {"check_run_id": "300"},
        _check_update_check_run,
    ),
    (
        SourceCodeManager.minimize_comment,
        {"comment_node_id": "IC_abc", "reason": "OUTDATED"},
        _check_none,
    ),
    (
        SourceCodeManager.resolve_review_thread,
        {"thread_node_id": "PRT_abc"},
        _check_none,
    ),
)


@pytest.mark.parametrize(("method", "kwargs", "check"), ACTION_TESTS)
def test_action_success(method, kwargs: dict[str, Any], check):
    metrics = []

    def record_count(k, a, t):
        metrics.append((k, a, t))

    scm = SourceCodeManager(BaseTestProvider(), record_count=record_count)
    check(method(scm, **kwargs))

    assert metrics == [
        ("sentry.scm.actions.success_by_provider", 1, {"provider": "BaseTestProvider"}),
        ("sentry.scm.actions.success_by_referrer", 1, {"referrer": "shared"}),
    ]


def test_provider_exception_is_not_wrapped():
    """SCMProviderException should pass through exec_provider_fn, not be wrapped as SCMUnhandledException."""

    class FailingProvider(BaseTestProvider):
        def get_issue_reactions(
            self, issue_id: str, pagination=None, request_options=None
        ) -> PaginatedActionResult[ReactionResult]:
            raise SCMProviderException("GitHub API error")

    scm = SourceCodeManager(FailingProvider())

    with pytest.raises(SCMProviderException):
        scm.get_issue_reactions(issue_id="1")
