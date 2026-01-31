from typing import Any

import pytest

from sentry.scm.actions import SourceCodeManager
from sentry.scm.errors import (
    SCMRateLimitExceeded,
    SCMRepositoryInactive,
    SCMRepositoryNotFound,
    SCMRepositoryOrganizationMismatch,
)
from tests.sentry.scm.fixtures import BaseTestProvider


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

    with pytest.raises(SCMRateLimitExceeded):
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

    with pytest.raises(SCMRepositoryNotFound):
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

    with pytest.raises(SCMRepositoryInactive):
        getattr(scm, method)(**kwargs)


@pytest.mark.parametrize(
    ("method", "kwargs"),
    (("create_issue_reaction", {"issue_id": "1", "reaction": "eyes"}),),
)
def test_repository_organization_mismatch(method: str, kwargs: dict[str, Any]):
    scm = SourceCodeManager(organization_id=2, repository_id=1, fetch_repository=fetch_repository)

    with pytest.raises(SCMRepositoryOrganizationMismatch):
        getattr(scm, method)(**kwargs)


def test_create_issue_reaction():
    scm = SourceCodeManager(
        organization_id=1,
        repository_id=1,
        fetch_repository=fetch_repository,
        fetch_service_provider=lambda _a, _b: BaseTestProvider(),
    )
    scm.create_issue_reaction(issue_id="1", reaction="eyes")
