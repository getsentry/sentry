from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from scm.types import CreateIssueCommentProtocol

from sentry.models.repository import Repository
from sentry.scm.cases._common import manager_for_repository
from sentry.scm.errors import SCMCapabilityUnsupported

_REFERRER = "sentry.integrations.github.issue_sync"


def create_comment(repository: Repository, issue_id: str, body: str) -> Mapping[str, Any]:
    manager = manager_for_repository(repository, _REFERRER)
    if not isinstance(manager, CreateIssueCommentProtocol):
        raise SCMCapabilityUnsupported("create_issue_comment", repository.provider)

    result = manager.create_issue_comment(issue_id=issue_id, body=body)
    return result["data"]
