import pytest

from sentry.scm.actions import create_issue_reaction
from sentry.scm.errors import (
    SCMRateLimitExceeded,
    SCMRepositoryInactive,
    SCMRepositoryNotFound,
    SCMRepositoryOrganizationMismatch,
)
from tests.sentry.scm.fixtures import BaseTestProvider


def fetch_repository(oid, rid):
    return {"integration_id": 1, "name": "test", "organization_id": 1, "status": "active"}


def test_rate_limited_action():
    class RateLimitedProvider(BaseTestProvider):
        def is_rate_limited(self, oid, ref):
            return True

    with pytest.raises(SCMRateLimitExceeded):
        create_issue_reaction(
            organization_id=1,
            repository_id=1,
            issue_id="1",
            reaction="eyes",
            fetch_repository=fetch_repository,
            fetch_service_provider=lambda _: RateLimitedProvider(),
        )


def test_repository_not_found():
    with pytest.raises(SCMRepositoryNotFound):
        create_issue_reaction(
            organization_id=1,
            repository_id=1,
            issue_id="1",
            reaction="eyes",
            fetch_repository=lambda _a, _b: None,
        )


def test_repository_inactive():
    with pytest.raises(SCMRepositoryInactive):
        create_issue_reaction(
            organization_id=1,
            repository_id=1,
            issue_id="1",
            reaction="eyes",
            fetch_repository=lambda _a, _b: {
                "integration_id": 1,
                "name": "test",
                "organization_id": 1,
                "status": "inactive",
            },
        )


def test_repository_organization_mismatch():
    with pytest.raises(SCMRepositoryOrganizationMismatch):
        create_issue_reaction(
            organization_id=2,
            repository_id=1,
            issue_id="1",
            reaction="eyes",
            fetch_repository=fetch_repository,
        )


def test_create_issue_reaction():
    create_issue_reaction(
        organization_id=1,
        repository_id=1,
        issue_id="1",
        reaction="eyes",
        fetch_repository=fetch_repository,
        fetch_service_provider=lambda _: BaseTestProvider(),
    )
