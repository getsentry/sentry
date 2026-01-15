from __future__ import annotations

from sentry.models.organization import Organization
from sentry.preprod.models import PreprodArtifact


def get_preprod_artifact_url(preprod_artifact: PreprodArtifact, view_type: str = "size") -> str:
    """
    Build a region/customer-domain aware absolute URL for the preprod artifact UI.
    """
    organization: Organization = Organization.objects.get_from_cache(
        id=preprod_artifact.project.organization_id
    )

    path = f"/organizations/{organization.slug}/preprod/{view_type}/{preprod_artifact.id}?project={preprod_artifact.project.slug}"
    return organization.absolute_url(path)


def get_preprod_artifact_comparison_url(
    preprod_artifact: PreprodArtifact, base_artifact: PreprodArtifact, comparison_type: str = "size"
) -> str:
    """
    Build a region/customer-domain aware absolute URL for the preprod artifact comparison UI.
    """
    organization: Organization = Organization.objects.get_from_cache(
        id=preprod_artifact.project.organization_id
    )
    path = f"/organizations/{organization.slug}/preprod/{comparison_type}/compare/{preprod_artifact.id}/{base_artifact.id}?project={preprod_artifact.project.slug}"
    return organization.absolute_url(path)
