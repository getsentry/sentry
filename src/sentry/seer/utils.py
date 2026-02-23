from django.db.models import Q, QuerySet

from sentry.constants import ObjectStatus
from sentry.models.repository import Repository


def filter_repo_by_provider(
    organization_id: int,
    provider: str,
    external_id: str,
    owner: str,
    name: str,
) -> QuerySet[Repository]:
    """
    Filter for an active repository by its provider, external ID, and owner/name.
    """
    return Repository.objects.filter(
        Q(provider=provider) | Q(provider=f"integrations:{provider}"),
        organization_id=organization_id,
        external_id=external_id,
        name=f"{owner}/{name}",
        status=ObjectStatus.ACTIVE,
    )
