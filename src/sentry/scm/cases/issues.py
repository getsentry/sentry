from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from typing import Any

from scm.types import (
    CreateIssueCommentProtocol,
    CreateIssueProtocol,
    GetIssueProtocol,
    GetRepositoryAssigneesProtocol,
    GetRepositoryLabelsProtocol,
)

from sentry.models.repository import Repository
from sentry.scm.cases._common import manager_for_repository
from sentry.scm.errors import SCMCapabilityUnsupported

_REFERRER = "sentry.integrations.github.issues"


def create_issue(
    repository: Repository,
    title: str,
    body: str,
    assignee: str | None = None,
    labels: Sequence[str] | None = None,
) -> Mapping[str, Any]:
    manager = manager_for_repository(repository, _REFERRER)
    if not isinstance(manager, CreateIssueProtocol):
        raise SCMCapabilityUnsupported("create_issue", repository.provider)

    result = manager.create_issue(
        title=title,
        body=body,
        assignees=[assignee] if assignee else None,
        labels=list(labels) if labels else None,
    )
    issue = result["data"]
    return {
        "key": issue["id"],
        "title": issue["title"],
        "description": issue["body"],
        "url": issue["html_url"],
        "repo": repository.name,
    }


def get_issue(repository: Repository, issue_id: str) -> Mapping[str, Any]:
    manager = manager_for_repository(repository, _REFERRER)
    if not isinstance(manager, GetIssueProtocol):
        raise SCMCapabilityUnsupported("get_issue", repository.provider)

    result = manager.get_issue(issue_id)
    issue = result["data"]
    return {
        "key": issue["id"],
        "title": issue["title"],
        "description": issue["body"],
        "url": issue["html_url"],
        "repo": repository.name,
    }


def create_issue_comment(repository: Repository, issue_id: str, body: str) -> None:
    manager = manager_for_repository(repository, _REFERRER)
    if not isinstance(manager, CreateIssueCommentProtocol):
        raise SCMCapabilityUnsupported("create_issue_comment", repository.provider)

    manager.create_issue_comment(issue_id=issue_id, body=body)


def get_repository_assignees(repository: Repository) -> Sequence[tuple[str, str]]:
    manager = manager_for_repository(repository, _REFERRER)
    if not isinstance(manager, GetRepositoryAssigneesProtocol):
        return []

    paginated = manager.get_repository_assignees()
    users = tuple((author["username"], author["username"]) for author in paginated["data"])
    return (("", "Unassigned"),) + users


def get_repository_labels(repository: Repository) -> Sequence[tuple[str, str]]:
    manager = manager_for_repository(repository, _REFERRER)
    if not isinstance(manager, GetRepositoryLabelsProtocol):
        return []

    paginated = manager.get_repository_labels()

    def natural_sort_pair(pair: tuple[str, str]) -> list[str | int]:
        return [
            int(text) if text.isdecimal() else text.lower()
            for text in re.split("([0-9]+)", pair[0])
        ]

    return tuple(
        sorted(
            [(label["name"], label["name"]) for label in paginated["data"]],
            key=natural_sort_pair,
        )
    )
