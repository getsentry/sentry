from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from scm.types import (
    GetIssueCommentsProtocol,
    GetPullRequestCommentsProtocol,
    GetPullRequestFilesProtocol,
    GetPullRequestProtocol,
)

from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.scm.cases._common import manager_for_repository
from sentry.scm.errors import SCMCapabilityUnsupported

_REFERRER = "sentry.preprod.integration_utils"


def _resolve_repository(organization: Organization, repo_name: str) -> Repository | None:
    return Repository.objects.filter(
        organization_id=organization.id,
        name=repo_name,
    ).first()


def get_pull_request(
    organization: Organization, repo_name: str, pr_number: str
) -> Mapping[str, Any] | None:
    """Returns the raw provider payload, mirroring what callers currently consume."""
    repository = _resolve_repository(organization, repo_name)
    if repository is None:
        return None

    manager = manager_for_repository(repository, _REFERRER)
    if not isinstance(manager, GetPullRequestProtocol):
        raise SCMCapabilityUnsupported("get_pull_request", repository.provider)

    result = manager.get_pull_request(pr_number)
    return result["raw"]["data"]


def get_pull_request_files(
    organization: Organization, repo_name: str, pr_number: str
) -> Sequence[Mapping[str, Any]] | None:
    repository = _resolve_repository(organization, repo_name)
    if repository is None:
        return None

    manager = manager_for_repository(repository, _REFERRER)
    if not isinstance(manager, GetPullRequestFilesProtocol):
        raise SCMCapabilityUnsupported("get_pull_request_files", repository.provider)

    paginated = manager.get_pull_request_files(pr_number)
    return paginated["raw"]["data"]


def get_issue_comments(
    organization: Organization, repo_name: str, pr_number: str
) -> Sequence[Mapping[str, Any]] | None:
    repository = _resolve_repository(organization, repo_name)
    if repository is None:
        return None

    manager = manager_for_repository(repository, _REFERRER)
    if not isinstance(manager, GetIssueCommentsProtocol):
        raise SCMCapabilityUnsupported("get_issue_comments", repository.provider)

    paginated = manager.get_issue_comments(pr_number)
    return paginated["raw"]["data"]


def get_pull_request_comments(
    organization: Organization, repo_name: str, pr_number: str
) -> Sequence[Mapping[str, Any]] | None:
    repository = _resolve_repository(organization, repo_name)
    if repository is None:
        return None

    manager = manager_for_repository(repository, _REFERRER)
    if not isinstance(manager, GetPullRequestCommentsProtocol):
        raise SCMCapabilityUnsupported("get_pull_request_comments", repository.provider)

    paginated = manager.get_pull_request_comments(pr_number)
    return paginated["raw"]["data"]
