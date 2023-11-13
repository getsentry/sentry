from __future__ import annotations

from sentry.models.repository import Repository
from sentry.services.hybrid_cloud.repository import RpcRepository


def serialize_repository(repository: Repository) -> RpcRepository:
    return RpcRepository(
        id=repository.id,
        organization_id=repository.organization_id,
        name=repository.name,
        external_id=repository.external_id,
        config=repository.config,
        integration_id=repository.integration_id,
        provider=repository.provider,
        status=repository.status,
        url=repository.url,
    )
