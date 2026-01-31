from contextlib import contextmanager
from typing import Any

import pytest

from sentry.scm.actions import SourceCodeManager
from sentry.scm.errors import SCMCodedError
from tests.sentry.scm.fixtures import BaseTestProvider


@contextmanager
def raises_with_code(exc_class, code):
    with pytest.raises(exc_class) as exc_info:
        yield exc_info
    assert exc_info.value.code == code, f"Expected code {code!r}, got {exc_info.value.code!r}"


def fetch_repository(oid, rid):
    return {"integration_id": 1, "name": "test", "organization_id": 1, "status": "active"}


@pytest.mark.parametrize(
    ("method", "kwargs"),
    (("create_issue_reaction", {"issue_id": "1", "reaction": "eyes"}),),
)
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


@pytest.mark.parametrize(
    ("method", "kwargs"),
    (("create_issue_reaction", {"issue_id": "1", "reaction": "eyes"}),),
)
def test_repository_not_found(method: str, kwargs: dict[str, Any]):
    scm = SourceCodeManager(
        organization_id=1,
        repository_id=1,
        fetch_repository=lambda _a, _b: None,
    )

    with raises_with_code(SCMCodedError, "repository_not_found"):
        getattr(scm, method)(**kwargs)


@pytest.mark.parametrize(
    ("method", "kwargs"),
    (("create_issue_reaction", {"issue_id": "1", "reaction": "eyes"}),),
)
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


@pytest.mark.parametrize(
    ("method", "kwargs"),
    (("create_issue_reaction", {"issue_id": "1", "reaction": "eyes"}),),
)
def test_repository_organization_mismatch(method: str, kwargs: dict[str, Any]):
    scm = SourceCodeManager(organization_id=2, repository_id=1, fetch_repository=fetch_repository)

    with raises_with_code(SCMCodedError, "repository_organization_mismatch"):
        getattr(scm, method)(**kwargs)


def test_create_issue_reaction():
    scm = SourceCodeManager(
        organization_id=1,
        repository_id=1,
        fetch_repository=fetch_repository,
        fetch_service_provider=lambda _a, _b: BaseTestProvider(),
    )
    scm.create_issue_reaction(issue_id="1", reaction="eyes")
