from collections.abc import Callable
from contextlib import contextmanager
from typing import Any

import pytest

from sentry.scm.actions import (
    SourceCodeManager,
    compare_commits,
    create_branch,
    create_check_run,
    create_git_blob,
    create_git_commit,
    create_git_tree,
    create_issue_comment,
    create_issue_comment_reaction,
    create_issue_reaction,
    create_pull_request,
    create_pull_request_comment,
    create_pull_request_comment_reaction,
    create_pull_request_draft,
    create_pull_request_reaction,
    create_review,
    create_review_comment_file,
    create_review_comment_reply,
    delete_issue_comment,
    delete_issue_comment_reaction,
    delete_issue_reaction,
    delete_pull_request_comment,
    delete_pull_request_comment_reaction,
    delete_pull_request_reaction,
    get_branch,
    get_capabilities,
    get_check_run,
    get_commit,
    get_commits,
    get_commits_by_path,
    get_file_content,
    get_git_commit,
    get_issue_comment_reactions,
    get_issue_comments,
    get_issue_reactions,
    get_pull_request,
    get_pull_request_comment_reactions,
    get_pull_request_comments,
    get_pull_request_commits,
    get_pull_request_diff,
    get_pull_request_files,
    get_pull_request_reactions,
    get_pull_requests,
    get_tree,
    minimize_comment,
    request_review,
    update_branch,
    update_check_run,
    update_pull_request,
)
from sentry.scm.errors import (
    SCMCodedError,
    SCMProviderException,
    SCMUnhandledException,
)
from sentry.scm.private.provider import GetBranchProtocol, GetIssueReactionsProtocol
from sentry.scm.types import PaginatedActionResult, ReactionResult, Referrer, Repository
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
        "external_id": None,
    }


ALL_ACTIONS: tuple[tuple[Callable[..., Any], dict[str, Any]], ...] = (
    # Issue comments
    (get_issue_comments, {"issue_id": "1"}),
    (create_issue_comment, {"issue_id": "1", "body": "test"}),
    (delete_issue_comment, {"issue_id": "1", "comment_id": "1"}),
    # Pull request
    (get_pull_request, {"pull_request_id": "1"}),
    # Pull request comments
    (get_pull_request_comments, {"pull_request_id": "1"}),
    (create_pull_request_comment, {"pull_request_id": "1", "body": "test"}),
    (delete_pull_request_comment, {"pull_request_id": "1", "comment_id": "1"}),
    # Issue comment reactions
    (get_issue_comment_reactions, {"issue_id": "1", "comment_id": "1"}),
    (create_issue_comment_reaction, {"issue_id": "1", "comment_id": "1", "reaction": "eyes"}),
    (delete_issue_comment_reaction, {"issue_id": "1", "comment_id": "1", "reaction_id": "123"}),
    # Pull request comment reactions
    (get_pull_request_comment_reactions, {"pull_request_id": "1", "comment_id": "1"}),
    (
        create_pull_request_comment_reaction,
        {"pull_request_id": "1", "comment_id": "1", "reaction": "eyes"},
    ),
    (
        delete_pull_request_comment_reaction,
        {"pull_request_id": "1", "comment_id": "1", "reaction_id": "123"},
    ),
    # Issue reactions
    (get_issue_reactions, {"issue_id": "1"}),
    (create_issue_reaction, {"issue_id": "1", "reaction": "eyes"}),
    (delete_issue_reaction, {"issue_id": "1", "reaction_id": "456"}),
    # Pull request reactions
    (get_pull_request_reactions, {"pull_request_id": "1"}),
    (create_pull_request_reaction, {"pull_request_id": "1", "reaction": "eyes"}),
    (delete_pull_request_reaction, {"pull_request_id": "1", "reaction_id": "456"}),
    # Branch operations
    (get_branch, {"branch": "main"}),
    (create_branch, {"branch": "feature", "sha": "abc123"}),
    (update_branch, {"branch": "feature", "sha": "def456"}),
    # Git blob operations
    (create_git_blob, {"content": "hello", "encoding": "utf-8"}),
    # File content operations
    (get_file_content, {"path": "README.md"}),
    # Commit operations
    (get_commit, {"sha": "abc123"}),
    (get_commits, {}),
    (get_commits_by_path, {"path": "src/main.py"}),
    (compare_commits, {"start_sha": "aaa", "end_sha": "bbb"}),
    # Git data operations
    (get_tree, {"tree_sha": "tree123"}),
    (get_git_commit, {"sha": "abc123"}),
    (create_git_tree, {"tree": [{"path": "f.py", "mode": "100644", "type": "blob", "sha": "x"}]}),
    (create_git_commit, {"message": "msg", "tree_sha": "t", "parent_shas": ["p"]}),
    # Expanded pull request operations
    (get_pull_request_files, {"pull_request_id": "1"}),
    (get_pull_request_commits, {"pull_request_id": "1"}),
    (get_pull_request_diff, {"pull_request_id": "1"}),
    (get_pull_requests, {}),
    (create_pull_request, {"title": "T", "body": "B", "head": "h", "base": "b"}),
    (create_pull_request_draft, {"title": "T", "body": "B", "head": "h", "base": "b"}),
    (update_pull_request, {"pull_request_id": "1"}),
    (request_review, {"pull_request_id": "1", "reviewers": ["user1"]}),
    # Review operations
    (
        create_review_comment_file,
        {
            "pull_request_id": "1",
            "commit_id": "abc",
            "body": "comment",
            "path": "f.py",
            "side": "RIGHT",
        },
    ),
    (
        create_review_comment_reply,
        {
            "pull_request_id": "1",
            "body": "comment",
            "comment_id": "123",
        },
    ),
    (
        create_review,
        {
            "pull_request_id": "1",
            "commit_sha": "abc",
            "event": "comment",
            "comments": [],
        },
    ),
    # Check run operations
    (create_check_run, {"name": "check", "head_sha": "abc"}),
    (get_check_run, {"check_run_id": "300"}),
    (update_check_run, {"check_run_id": "300"}),
    # GraphQL mutation operations
    (minimize_comment, {"comment_node_id": "IC_abc", "reason": "OUTDATED"}),
)


@pytest.mark.parametrize(("action", "kwargs"), ALL_ACTIONS)
def test_rate_limited_action(action: Callable[..., Any], kwargs: dict[str, Any]):
    class RateLimitedProvider(BaseTestProvider):
        def is_rate_limited(self, referrer):
            return True

    scm = SourceCodeManager(RateLimitedProvider())

    with raises_with_code(SCMCodedError, "rate_limit_exceeded"):
        action(scm, **kwargs)


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
                "external_id": None,
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
    (get_issue_comments, {"issue_id": "1"}, _check_issue_comments),
    (
        create_issue_comment,
        {"issue_id": "1", "body": "test"},
        _check_created_comment,
    ),
    (delete_issue_comment, {"issue_id": "1", "comment_id": "1"}, _check_none),
    (get_pull_request, {"pull_request_id": "1"}, _check_pull_request),
    (
        get_pull_request_comments,
        {"pull_request_id": "1"},
        _check_pull_request_comments,
    ),
    (
        create_pull_request_comment,
        {"pull_request_id": "1", "body": "test"},
        _check_created_pr_comment,
    ),
    (
        delete_pull_request_comment,
        {"pull_request_id": "1", "comment_id": "1"},
        _check_none,
    ),
    (
        get_issue_comment_reactions,
        {"issue_id": "1", "comment_id": "1"},
        _check_comment_reactions,
    ),
    (
        create_issue_comment_reaction,
        {"issue_id": "1", "comment_id": "1", "reaction": "eyes"},
        _check_created_reaction,
    ),
    (
        delete_issue_comment_reaction,
        {"issue_id": "1", "comment_id": "1", "reaction_id": "123"},
        _check_none,
    ),
    (
        get_pull_request_comment_reactions,
        {"pull_request_id": "1", "comment_id": "1"},
        _check_pr_comment_reactions,
    ),
    (
        create_pull_request_comment_reaction,
        {"pull_request_id": "1", "comment_id": "1", "reaction": "eyes"},
        _check_created_reaction,
    ),
    (
        delete_pull_request_comment_reaction,
        {"pull_request_id": "1", "comment_id": "1", "reaction_id": "123"},
        _check_none,
    ),
    (get_issue_reactions, {"issue_id": "1"}, _check_issue_reactions),
    (
        create_issue_reaction,
        {"issue_id": "1", "reaction": "eyes"},
        _check_created_reaction,
    ),
    (delete_issue_reaction, {"issue_id": "1", "reaction_id": "456"}, _check_none),
    (
        get_pull_request_reactions,
        {"pull_request_id": "1"},
        _check_pr_reactions,
    ),
    (
        create_pull_request_reaction,
        {"pull_request_id": "1", "reaction": "eyes"},
        _check_created_reaction,
    ),
    (
        delete_pull_request_reaction,
        {"pull_request_id": "1", "reaction_id": "456"},
        _check_none,
    ),
    (get_branch, {"branch": "main"}, _check_get_branch),
    (create_branch, {"branch": "feature", "sha": "abc123"}, _check_create_branch),
    (update_branch, {"branch": "feature", "sha": "def456"}, _check_update_branch),
    (
        create_git_blob,
        {"content": "hello", "encoding": "utf-8"},
        _check_create_git_blob,
    ),
    (get_file_content, {"path": "README.md"}, _check_file_content),
    (get_commit, {"sha": "abc123"}, _check_get_commit),
    (get_commits, {}, _check_get_commits),
    (get_commits_by_path, {"path": "src/main.py"}, _check_get_commits),
    (
        compare_commits,
        {"start_sha": "aaa", "end_sha": "bbb"},
        _check_compare_commits,
    ),
    (get_tree, {"tree_sha": "tree123"}, _check_get_tree),
    (get_git_commit, {"sha": "abc123"}, _check_get_git_commit),
    (
        create_git_tree,
        {"tree": [{"path": "f.py", "mode": "100644", "type": "blob", "sha": "x"}]},
        _check_create_git_tree,
    ),
    (
        create_git_commit,
        {"message": "msg", "tree_sha": "t", "parent_shas": ["p"]},
        _check_create_git_commit,
    ),
    (get_pull_request_files, {"pull_request_id": "1"}, _check_pr_files),
    (get_pull_request_commits, {"pull_request_id": "1"}, _check_pr_commits),
    (get_pull_request_diff, {"pull_request_id": "1"}, _check_pr_diff),
    (get_pull_requests, {}, _check_list_pull_requests),
    (
        create_pull_request,
        {"title": "T", "body": "B", "head": "h", "base": "b"},
        _check_create_pull_request,
    ),
    (
        create_pull_request_draft,
        {"title": "T", "body": "B", "head": "h", "base": "b"},
        _check_create_pull_request,
    ),
    (update_pull_request, {"pull_request_id": "1"}, _check_update_pull_request),
    (
        request_review,
        {"pull_request_id": "1", "reviewers": ["user1"]},
        _check_none,
    ),
    (
        create_review_comment_file,
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
        create_review_comment_reply,
        {
            "pull_request_id": "1",
            "body": "comment",
            "comment_id": "123",
        },
        _check_review_comment,
    ),
    (
        create_review,
        {
            "pull_request_id": "1",
            "commit_sha": "abc",
            "event": "comment",
            "comments": [],
        },
        _check_review,
    ),
    (
        create_check_run,
        {"name": "check", "head_sha": "abc"},
        _check_create_check_run,
    ),
    (
        get_check_run,
        {"check_run_id": "300"},
        _check_get_check_run,
    ),
    (
        update_check_run,
        {"check_run_id": "300"},
        _check_update_check_run,
    ),
    (
        minimize_comment,
        {"comment_node_id": "IC_abc", "reason": "OUTDATED"},
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
        assert isinstance(scm, GetIssueReactionsProtocol)
        scm.get_issue_reactions(issue_id="1")


class MinimalProvider:
    """A provider that implements Provider but no action protocols."""

    organization_id: int = 1
    repository: Repository = {
        "integration_id": 1,
        "name": "test",
        "organization_id": 1,
        "is_active": True,
        "external_id": None,
    }

    def is_rate_limited(self, referrer: Referrer) -> bool:
        return False


@pytest.mark.parametrize(("action", "kwargs"), ALL_ACTIONS)
def test_exec_raises_provider_not_supported_for_all_actions(
    action: Callable[..., Any],
    kwargs: dict[str, Any],
):
    """Every SCM action raises SCMProviderNotSupported when the provider lacks the protocol."""
    scm = SourceCodeManager(MinimalProvider())

    with pytest.raises(AttributeError):
        action(scm, **kwargs)


def test_exec_wraps_unhandled_exception():
    """Non-SCM exceptions raised by the provider are wrapped as SCMUnhandledException."""

    class ExplodingProvider(BaseTestProvider):
        def get_branch(self, branch, request_options=None):
            raise RuntimeError("unexpected failure")

    scm = SourceCodeManager(ExplodingProvider())

    with pytest.raises(SCMUnhandledException):
        assert isinstance(scm, GetBranchProtocol)
        scm.get_branch(branch="main")


def test_exec_records_failure_metric_on_unhandled_exception():
    """record_count is called with the failure metric when a non-SCM exception occurs."""
    metrics: list[tuple[str, int, dict[str, str]]] = []

    class ExplodingProvider(BaseTestProvider):
        def get_branch(self, branch, request_options=None):
            raise RuntimeError("boom")

    scm = SourceCodeManager(
        ExplodingProvider(), record_count=lambda k, a, t: metrics.append((k, a, t))
    )

    with pytest.raises(SCMUnhandledException):
        assert isinstance(scm, GetBranchProtocol)
        scm.get_branch(branch="main")

    assert metrics == [("sentry.scm.actions.failed", 1, {})]


def test_exec_passes_custom_referrer():
    """The referrer set on SourceCodeManager is forwarded through _exec to exec_provider_fn."""
    metrics: list[tuple[str, int, dict[str, str]]] = []

    scm = SourceCodeManager(
        BaseTestProvider(),
        referrer="autofix",
        record_count=lambda k, a, t: metrics.append((k, a, t)),
    )
    assert isinstance(scm, GetBranchProtocol)
    scm.get_branch(branch="main")

    referrer_metrics = [(k, a, t) for k, a, t in metrics if "referrer" in t]
    assert referrer_metrics == [
        ("sentry.scm.actions.success_by_referrer", 1, {"referrer": "autofix"}),
    ]


def test_exec_passes_custom_record_count():
    """A custom record_count callable provided at construction is used by _exec."""
    calls: list[tuple[str, int, dict[str, str]]] = []

    def custom_record(key: str, amount: int, tags: dict[str, str]) -> None:
        calls.append((key, amount, tags))

    scm = SourceCodeManager(BaseTestProvider(), record_count=custom_record)
    assert isinstance(scm, GetBranchProtocol)
    scm.get_branch(branch="main")

    assert len(calls) == 2
    assert calls[0] == (
        "sentry.scm.actions.success_by_provider",
        1,
        {"provider": "BaseTestProvider"},
    )
    assert calls[1] == ("sentry.scm.actions.success_by_referrer", 1, {"referrer": "shared"})


def test_get_capabilities():
    assert list(get_capabilities(SourceCodeManager(BaseTestProvider()))) == [
        "CompareCommits",
        "CreateBranch",
        "CreateCheckRun",
        "CreateGitBlob",
        "CreateGitCommit",
        "CreateGitTree",
        "CreateIssueComment",
        "CreateIssueCommentReaction",
        "CreateIssueReaction",
        "CreatePullRequestComment",
        "CreatePullRequestCommentReaction",
        "CreatePullRequestDraft",
        "CreatePullRequest",
        "CreatePullRequestReaction",
        "CreateReviewCommentFile",
        "CreateReviewCommentReply",
        "CreateReview",
        "DeleteIssueComment",
        "DeleteIssueCommentReaction",
        "DeleteIssueReaction",
        "DeletePullRequestComment",
        "DeletePullRequestCommentReaction",
        "DeletePullRequestReaction",
        "GetBranch",
        "GetCheckRun",
        "GetCommit",
        "GetCommitsByPath",
        "GetCommits",
        "GetFileContent",
        "GetGitCommit",
        "GetIssueCommentReactions",
        "GetIssueComments",
        "GetIssueReactions",
        "GetPullRequestCommentReactions",
        "GetPullRequestComments",
        "GetPullRequestCommits",
        "GetPullRequestDiff",
        "GetPullRequestFiles",
        "GetPullRequest",
        "GetPullRequestReactions",
        "GetPullRequests",
        "GetTree",
        "MinimizeComment",
        "RequestReview",
        "UpdateBranch",
        "UpdateCheckRun",
        "UpdatePullRequest",
    ]

    class IncapableProvider:
        organization_id: int
        repository: Repository

        def is_rate_limited(self, referrer: Referrer) -> bool:
            return False

    assert list(get_capabilities(SourceCodeManager(IncapableProvider()))) == []
