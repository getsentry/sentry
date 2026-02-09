from contextlib import contextmanager
from typing import Any

import pytest

from sentry.constants import ObjectStatus
from sentry.scm.actions import SourceCodeManager
from sentry.scm.errors import SCMCodedError, SCMProviderException
from sentry.scm.types import ReactionResult, Repository
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
        "status": ObjectStatus.ACTIVE,
    }


ALL_ACTIONS = (
    # Issue comments
    ("get_issue_comments", {"issue_id": "1"}),
    ("create_issue_comment", {"issue_id": "1", "body": "test"}),
    ("delete_issue_comment", {"comment_id": "1"}),
    # Pull request
    ("get_pull_request", {"pull_request_id": "1"}),
    # Pull request comments
    ("get_pull_request_comments", {"pull_request_id": "1"}),
    ("create_pull_request_comment", {"pull_request_id": "1", "body": "test"}),
    ("delete_pull_request_comment", {"comment_id": "1"}),
    # Issue comment reactions
    ("get_issue_comment_reactions", {"comment_id": "1"}),
    ("create_issue_comment_reaction", {"comment_id": "1", "reaction": "eyes"}),
    ("delete_issue_comment_reaction", {"comment_id": "1", "reaction_id": "123"}),
    # Pull request comment reactions
    ("get_pull_request_comment_reactions", {"comment_id": "1"}),
    ("create_pull_request_comment_reaction", {"comment_id": "1", "reaction": "eyes"}),
    ("delete_pull_request_comment_reaction", {"comment_id": "1", "reaction_id": "123"}),
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
)


@pytest.mark.parametrize(("method", "kwargs"), ALL_ACTIONS)
def test_rate_limited_action(method: str, kwargs: dict[str, Any]):
    class RateLimitedProvider(BaseTestProvider):
        def is_rate_limited(self, oid, ref):
            return True

    scm = SourceCodeManager(
        organization_id=1,
        repository_id=1,
        fetch_repository=fetch_repository,
        fetch_service_provider=lambda _a, _b: RateLimitedProvider(),
    )

    with raises_with_code(SCMCodedError, "rate_limit_exceeded"):
        getattr(scm, method)(**kwargs)


@pytest.mark.parametrize(("method", "kwargs"), ALL_ACTIONS)
def test_repository_not_found(method: str, kwargs: dict[str, Any]):
    scm = SourceCodeManager(
        organization_id=1,
        repository_id=1,
        fetch_repository=lambda _a, _b: None,
    )

    with raises_with_code(SCMCodedError, "repository_not_found"):
        getattr(scm, method)(**kwargs)


@pytest.mark.parametrize(("method", "kwargs"), ALL_ACTIONS)
def test_repository_inactive(method: str, kwargs: dict[str, Any]):
    scm = SourceCodeManager(
        organization_id=1,
        repository_id=1,
        fetch_repository=lambda _a, _b: {
            "integration_id": 1,
            "name": "test",
            "organization_id": 1,
            "status": ObjectStatus.DISABLED,
        },
    )

    with raises_with_code(SCMCodedError, "repository_inactive"):
        getattr(scm, method)(**kwargs)


@pytest.mark.parametrize(("method", "kwargs"), ALL_ACTIONS)
def test_repository_organization_mismatch(method: str, kwargs: dict[str, Any]):
    scm = SourceCodeManager(organization_id=2, repository_id=1, fetch_repository=fetch_repository)

    with raises_with_code(SCMCodedError, "repository_organization_mismatch"):
        getattr(scm, method)(**kwargs)


def make_scm():
    return SourceCodeManager(
        organization_id=1,
        repository_id=1,
        fetch_repository=fetch_repository,
        fetch_service_provider=lambda _a, _b: BaseTestProvider(),
    )


def _check_issue_comments(result: Any) -> None:
    assert len(result) == 1
    assert result[0]["comment"]["id"] == "101"
    assert result[0]["comment"]["body"] == "Test comment"
    assert result[0]["comment"]["author"]["username"] == "testuser"


def _check_pull_request(result: Any) -> None:
    pr = result["pull_request"]
    assert pr["head"]["sha"] == "abc123"


def _check_pull_request_comments(result: Any) -> None:
    assert len(result) == 1
    assert result[0]["comment"]["id"] == "201"
    assert result[0]["comment"]["body"] == "PR review comment"
    assert result[0]["comment"]["author"]["username"] == "reviewer"


def _check_comment_reactions(result: Any) -> None:
    assert len(result) == 2
    assert result[0]["id"] == "1"
    assert result[0]["content"] == "+1"
    assert result[1]["id"] == "2"
    assert result[1]["content"] == "eyes"


def _check_pr_comment_reactions(result: Any) -> None:
    assert len(result) == 2
    assert result[0]["id"] == "3"
    assert result[0]["content"] == "rocket"
    assert result[1]["id"] == "4"
    assert result[1]["content"] == "hooray"


def _check_issue_reactions(result: Any) -> None:
    assert len(result) == 2
    assert result[0]["id"] == "1"
    assert result[0]["content"] == "+1"
    assert result[0]["author"]["username"] == "testuser"
    assert result[1]["id"] == "2"
    assert result[1]["content"] == "heart"
    assert result[1]["author"]["username"] == "otheruser"


def _check_pr_reactions(result: Any) -> None:
    assert len(result) == 2
    assert result[0]["id"] == "5"
    assert result[0]["content"] == "laugh"
    assert result[0]["author"]["username"] == "testuser"
    assert result[1]["id"] == "6"
    assert result[1]["content"] == "confused"
    assert result[1]["author"]["username"] == "otheruser"


def _check_get_branch(result: Any) -> None:
    assert result["git_ref"]["ref"] == "refs/heads/main"
    assert result["git_ref"]["sha"] == "abc123def456"
    assert result["provider"] == "test"


def _check_create_branch(result: Any) -> None:
    assert result["git_ref"]["ref"] == "refs/heads/feature"
    assert result["git_ref"]["sha"] == "abc123"
    assert result["provider"] == "test"


def _check_none(result: Any) -> None:
    assert result is None


ACTION_TESTS = (
    (SourceCodeManager.get_issue_comments, {"issue_id": "1"}, _check_issue_comments),
    (SourceCodeManager.create_issue_comment, {"issue_id": "1", "body": "test"}, _check_none),
    (SourceCodeManager.delete_issue_comment, {"comment_id": "1"}, _check_none),
    (SourceCodeManager.get_pull_request, {"pull_request_id": "1"}, _check_pull_request),
    (
        SourceCodeManager.get_pull_request_comments,
        {"pull_request_id": "1"},
        _check_pull_request_comments,
    ),
    (
        SourceCodeManager.create_pull_request_comment,
        {"pull_request_id": "1", "body": "test"},
        _check_none,
    ),
    (SourceCodeManager.delete_pull_request_comment, {"comment_id": "1"}, _check_none),
    (SourceCodeManager.get_issue_comment_reactions, {"comment_id": "1"}, _check_comment_reactions),
    (
        SourceCodeManager.create_issue_comment_reaction,
        {"comment_id": "1", "reaction": "eyes"},
        _check_none,
    ),
    (
        SourceCodeManager.delete_issue_comment_reaction,
        {"comment_id": "1", "reaction_id": "123"},
        _check_none,
    ),
    (
        SourceCodeManager.get_pull_request_comment_reactions,
        {"comment_id": "1"},
        _check_pr_comment_reactions,
    ),
    (
        SourceCodeManager.create_pull_request_comment_reaction,
        {"comment_id": "1", "reaction": "eyes"},
        _check_none,
    ),
    (
        SourceCodeManager.delete_pull_request_comment_reaction,
        {"comment_id": "1", "reaction_id": "123"},
        _check_none,
    ),
    (SourceCodeManager.get_issue_reactions, {"issue_id": "1"}, _check_issue_reactions),
    (SourceCodeManager.create_issue_reaction, {"issue_id": "1", "reaction": "eyes"}, _check_none),
    (SourceCodeManager.delete_issue_reaction, {"issue_id": "1", "reaction_id": "456"}, _check_none),
    (
        SourceCodeManager.get_pull_request_reactions,
        {"pull_request_id": "1"},
        _check_pr_reactions,
    ),
    (
        SourceCodeManager.create_pull_request_reaction,
        {"pull_request_id": "1", "reaction": "eyes"},
        _check_none,
    ),
    (
        SourceCodeManager.delete_pull_request_reaction,
        {"pull_request_id": "1", "reaction_id": "456"},
        _check_none,
    ),
    (SourceCodeManager.get_branch, {"branch": "main"}, _check_get_branch),
    (SourceCodeManager.create_branch, {"branch": "feature", "sha": "abc123"}, _check_create_branch),
    (SourceCodeManager.update_branch, {"branch": "feature", "sha": "def456"}, _check_none),
)


@pytest.mark.parametrize(("method", "kwargs", "check"), ACTION_TESTS)
def test_action_success(method, kwargs: dict[str, Any], check):
    result = method(make_scm(), **kwargs)
    check(result)


def test_active_repository_with_int_status_is_not_rejected():
    """ObjectStatus.ACTIVE is 0 (int), but exec_provider_fn compares against the string "active".

    map_repository_model_to_repository copies RepositoryModel.status as-is (an int),
    so every real repository will fail the status check with repository_inactive.
    """
    from sentry.constants import ObjectStatus

    scm = SourceCodeManager(
        organization_id=1,
        repository_id=1,
        fetch_repository=lambda _a, _b: {
            "integration_id": 1,
            "name": "test",
            "organization_id": 1,
            "status": ObjectStatus.ACTIVE,
        },
        fetch_service_provider=lambda _a, _b: BaseTestProvider(),
    )

    # This should succeed, but currently raises SCMCodedError("repository_inactive")
    # because 0 != "active" is always True.
    result = scm.get_issue_comments(issue_id="1")
    assert len(result) == 1


def test_provider_exception_is_not_wrapped():
    """SCMProviderException should pass through exec_provider_fn, not be wrapped as SCMUnhandledException."""

    class FailingProvider(BaseTestProvider):
        def get_issue_reactions(
            self, repository: Repository, issue_id: str
        ) -> list[ReactionResult]:
            raise SCMProviderException("GitHub API error")

    scm = SourceCodeManager(
        organization_id=1,
        repository_id=1,
        fetch_repository=fetch_repository,
        fetch_service_provider=lambda _a, _b: FailingProvider(),
    )

    with pytest.raises(SCMProviderException):
        scm.get_issue_reactions(issue_id="1")
