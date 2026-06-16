"""
Audit log helpers for repository sync operations.
"""

from sentry import audit_log
from sentry.integrations.services.repository.model import RpcRepository
from sentry.utils.audit import create_system_audit_entry


def log_repo_change(
    *, event_name: str, organization_id: int, repo: RpcRepository, source: str, provider: str
) -> None:
    create_system_audit_entry(
        organization_id=organization_id,
        target_object=repo.id,
        event=audit_log.get_event_id(event_name),
        data={
            "repo_name": repo.name,
            "external_id": repo.external_id,
            "source": source,
            "provider": provider,
        },
    )
