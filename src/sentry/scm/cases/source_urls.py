from __future__ import annotations

from scm.types import GetFileUrlProtocol

from sentry.models.repository import Repository
from sentry.scm.cases._common import manager_for_repository
from sentry.scm.errors import SCMCapabilityUnsupported

_REFERRER = "sentry.integrations.github.integration"


def format_source_url(repository: Repository, filepath: str, branch: str | None) -> str:
    manager = manager_for_repository(repository, _REFERRER)
    if not isinstance(manager, GetFileUrlProtocol):
        raise SCMCapabilityUnsupported("get_file_url", repository.provider)
    return manager.get_file_url(filepath, branch or "")
