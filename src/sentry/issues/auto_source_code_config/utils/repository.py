from collections.abc import Mapping

from django.db import IntegrityError

from sentry.integrations.services.integration.model import RpcOrganizationIntegration
from sentry.models.repository import Repository
from sentry.utils import metrics

from ..constants import METRIC_PREFIX


def create_repository(
    repo_name: str,
    org_integration: RpcOrganizationIntegration,
    integration_provider: str,
    tags: Mapping[str, str | bool],
    external_id: str,
) -> Repository | None:
    organization_id = org_integration.organization_id
    created = False
    repository = (
        Repository.objects.filter(name=repo_name, organization_id=organization_id)
        .order_by("-date_added")
        .first()
    )
    if not repository:
        if not tags["dry_run"]:
            provider = f"integrations:{integration_provider}"
            try:
                repository, created = Repository.objects.get_or_create(
                    name=repo_name,
                    organization_id=organization_id,
                    integration_id=org_integration.integration_id,
                    defaults={"external_id": external_id, "provider": provider},
                )
            except IntegrityError:
                repository = get_repository_by_provider_identity(
                    organization_id, provider, external_id
                )
                if repository is None:
                    raise
        if created or tags["dry_run"]:
            metrics.incr(key=f"{METRIC_PREFIX}.repository.created", tags=tags, sample_rate=1.0)

    return repository


def get_repository_by_provider_identity(
    organization_id: int, provider: str, external_id: str
) -> Repository | None:
    """
    Name lookups miss a repository that was renamed on the provider, and creating it
    under the new name then collides with the row that already holds its identity.

    None means the collision wasn't on that identity (or the row is already gone),
    so the caller should re-raise its original error.
    """
    return Repository.objects.filter(
        organization_id=organization_id, provider=provider, external_id=external_id
    ).first()
