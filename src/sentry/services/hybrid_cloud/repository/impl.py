from __future__ import annotations

from typing import List, Optional

from sentry.constants import ObjectStatus
from sentry.models import Repository
from sentry.services.hybrid_cloud.repository import RepositoryService, RpcRepository
from sentry.services.hybrid_cloud.repository.serial import serialize_repository


class DatabaseBackedRepositoryService(RepositoryService):
    def get_repositories(
        self,
        *,
        organization_id: int,
        integration_id: Optional[int] = None,
        providers: Optional[List[str]] = None,
        has_integration: Optional[bool] = None,
        has_provider: Optional[bool] = None,
        status: Optional[ObjectStatus] = None,
    ) -> List[RpcRepository]:
        query = Repository.objects.filter(organization_id=organization_id)
        if integration_id is not None:
            query = query.filter(integration_id=integration_id)
        if providers is not None:
            query = query.filter(provider__in=providers)
        if has_integration is not None:
            query = query.filter(integration_id__isnull=not has_integration)
        if has_provider is not None:
            query = query.filter(provider__isnull=not has_provider)
        if status is not None:
            query = query.filter(status=status)
        return [serialize_repository(repo) for repo in query]

    def get_repository(self, *, organization_id: int, id: int) -> RpcRepository | None:
        repository = Repository.objects.filter(organization_id=organization_id, id=id).first()
        if repository is None:
            return None
        return serialize_repository(repository)

    def update_repository(self, *, organization_id: int, update: RpcRepository) -> None:
        repository = Repository.objects.filter(
            organization_id=organization_id, id=update.id
        ).first()
        if repository is None:
            return

        repository.name = update.name
        repository.external_id = update.external_id
        repository.config = update.config
        repository.integration_id = update.integration_id
        repository.provider = update.provider
        repository.status = update.status
        repository.save()
