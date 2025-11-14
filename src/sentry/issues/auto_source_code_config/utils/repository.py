from typing import int
from collections.abc import Mapping

from sentry.integrations.services.integration.model import RpcOrganizationIntegration
from sentry.models.repository import Repository
from sentry.utils import metrics

from ..constants import METRIC_PREFIX


def create_repository(
    repo_name: str, org_integration: RpcOrganizationIntegration, tags: Mapping[str, str | bool]
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
            repository, created = Repository.objects.get_or_create(
                name=repo_name,
                organization_id=organization_id,
                integration_id=org_integration.integration_id,
            )
        if created or tags["dry_run"]:
            metrics.incr(key=f"{METRIC_PREFIX}.repository.created", tags=tags, sample_rate=1.0)

    return repository
