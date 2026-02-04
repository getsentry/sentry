from contextlib import contextmanager
from typing import Any

import pytest

from sentry.scm.actions import SourceCodeManager
from sentry.scm.errors import SCMCodedError
from sentry.scm.types import Repository
from tests.sentry.scm.test_fixtures import BaseTestProvider


@contextmanager
def raises_with_code(exc_class, code):
    with pytest.raises(exc_class) as exc_info:
        yield exc_info
    assert exc_info.value.code == code, f"Expected code {code!r}, got {exc_info.value.code!r}"


def fetch_repository(oid, rid) -> Repository:
    return {"integration_id": 1, "name": "test", "organization_id": 1, "status": "active"}


ALL_ACTIONS = (
    # Issue comments
    ("get_issue_comments", {"issue_id": "1"}),
    ("create_issue_comment", {"issue_id": "1", "body": "test"}),
    ("delete_issue_comment", {"comment_id": "1"}),
    # Pull request comments
    ("get_pull_request_comments", {"pull_request_id": "1"}),
    ("create_pull_request_comment", {"pull_request_id": "1", "body": "test"}),
    ("delete_pull_request_comment", {"comment_id": "1"}),
    # Comment reactions
    ("get_comment_reactions", {"comment_id": "1"}),
    ("create_comment_reaction", {"comment_id": "1", "reaction": "eyes"}),
    ("delete_comment_reaction", {"comment_id": "1", "reaction": "eyes"}),
    # Issue reactions
    ("get_issue_reactions", {"issue_id": "1"}),
    ("create_issue_reaction", {"issue_id": "1", "reaction": "eyes"}),
    ("delete_issue_reaction", {"issue_id": "1", "reaction": "eyes"}),
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
            "status": "inactive",
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


def test_get_issue_comments():
    scm = make_scm()
    result = scm.get_issue_comments(issue_id="1")
    assert result == []


def test_create_issue_comment():
    scm = make_scm()
    scm.create_issue_comment(issue_id="1", body="test")


def test_delete_issue_comment():
    scm = make_scm()
    scm.delete_issue_comment(comment_id="1")


def test_get_pull_request_comments():
    scm = make_scm()
    result = scm.get_pull_request_comments(pull_request_id="1")
    assert result == []


def test_create_pull_request_comment():
    scm = make_scm()
    scm.create_pull_request_comment(pull_request_id="1", body="test")


def test_delete_pull_request_comment():
    scm = make_scm()
    scm.delete_pull_request_comment(comment_id="1")


def test_get_comment_reactions():
    scm = make_scm()
    result = scm.get_comment_reactions(comment_id="1")
    assert result == []


def test_create_comment_reaction():
    scm = make_scm()
    scm.create_comment_reaction(comment_id="1", reaction="eyes")


def test_delete_comment_reaction():
    scm = make_scm()
    scm.delete_comment_reaction(comment_id="1", reaction="eyes")


def test_get_issue_reactions():
    scm = make_scm()
    result = scm.get_issue_reactions(issue_id="1")
    assert result == []


def test_create_issue_reaction():
    scm = make_scm()
    scm.create_issue_reaction(issue_id="1", reaction="eyes")


def test_delete_issue_reaction():
    scm = make_scm()
    scm.delete_issue_reaction(issue_id="1", reaction="eyes")
