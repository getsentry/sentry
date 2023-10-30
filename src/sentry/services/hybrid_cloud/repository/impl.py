from __future__ import annotations

from typing import Any, List, Optional

from django.db import IntegrityError, router, transaction

from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.db.postgres.transactions import enforce_constraints
from sentry.models.integrations.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.projectcodeowners import ProjectCodeOwners
from sentry.models.repository import Repository
from sentry.services.hybrid_cloud.repository import RepositoryService, RpcRepository
from sentry.services.hybrid_cloud.repository.model import RpcCreateRepository
from sentry.services.hybrid_cloud.repository.serial import serialize_repository
from sentry.services.hybrid_cloud.user.model import RpcUser


class DatabaseBackedRepositoryService(RepositoryService):
    def serialize_repository(
        self,
        *,
        organization_id: int,
        id: int,
        as_user: Optional[RpcUser] = None,
    ) -> Optional[Any]:
        repository = Repository.objects.filter(id=id).first()
        if repository is None:
            return None
        return serialize(repository, user=as_user)

    def get_repositories(
        self,
        *,
        organization_id: int,
        integration_id: Optional[int] = None,
        external_id: Optional[int] = None,
        providers: Optional[List[str]] = None,
        has_integration: Optional[bool] = None,
        has_provider: Optional[bool] = None,
        status: Optional[ObjectStatus] = None,
    ) -> List[RpcRepository]:
        query = Repository.objects.filter(organization_id=organization_id)
        if integration_id is not None:
            query = query.filter(integration_id=integration_id)
        if external_id is not None:
            query = query.filter(external_id=external_id)
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

    def create_repository(
        self, *, organization_id: int, create: RpcCreateRepository
    ) -> RpcRepository | None:
        try:
            with enforce_constraints(transaction.atomic(router.db_for_write(Repository))):
                repository = Repository.objects.create(
                    organization_id=organization_id, **create.dict()
                )
                return serialize_repository(repository)
        except IntegrityError:
            return None

    def update_repository(self, *, organization_id: int, update: RpcRepository) -> None:
        with transaction.atomic(router.db_for_write(Repository)):
            repository = Repository.objects.filter(
                organization_id=organization_id, id=update.id
            ).first()
            if repository is None:
                return

            update_dict = update.dict()
            del update_dict["id"]

            for field_name, field_value in update_dict.items():
                setattr(repository, field_name, field_value)

            repository.save()

    def reinstall_repositories_for_integration(
        self, *, organization_id: int, integration_id: int, provider: str
    ) -> None:
        with transaction.atomic(router.db_for_write(Repository)):
            Repository.objects.filter(
                organization_id=organization_id,
                integration_id=integration_id,
                provider=provider,
            ).update(status=ObjectStatus.ACTIVE)

    def disassociate_organization_integration(
        self,
        *,
        organization_id: int,
        organization_integration_id: int,
        integration_id: int,
    ) -> None:
        with transaction.atomic(router.db_for_write(Repository)):
            # Disassociate repos from the organization integration being deleted
            Repository.objects.filter(
                organization_id=organization_id, integration_id=integration_id
            ).update(integration_id=None)

            # Delete Code Owners with a Code Mapping using the OrganizationIntegration
            ProjectCodeOwners.objects.filter(
                repository_project_path_config__in=RepositoryProjectPathConfig.objects.filter(
                    organization_integration_id=organization_integration_id
                ).values_list("id", flat=True)
            ).delete()

            # Delete the Code Mappings
            RepositoryProjectPathConfig.objects.filter(
                organization_integration_id=organization_integration_id
            ).delete()
