from __future__ import annotations

from sentry.models.organization import Organization
from sentry.preprod.models import PreprodArtifact


def get_preprod_artifact_url(preprod_artifact: PreprodArtifact) -> str:
    """
    Build a region/customer-domain aware absolute URL for the preprod artifact UI.

    New URL format: /organizations/{org}/explore/build/{artifact_id}/size/?project={project}
    """
    organization: Organization = Organization.objects.get_from_cache(
        id=preprod_artifact.project.organization_id
    )

    path = f"/organizations/{organization.slug}/explore/build/{preprod_artifact.id}/size/?project={preprod_artifact.project.slug}"
    return organization.absolute_url(path)


def get_preprod_artifact_comparison_url(
    preprod_artifact: PreprodArtifact, base_artifact: PreprodArtifact
) -> str:
    """
    Build a region/customer-domain aware absolute URL for the preprod artifact comparison UI.

    New URL format: /organizations/{org}/explore/build/compare/{head_id}/{base_id}/?project={project}
    """
    organization: Organization = Organization.objects.get_from_cache(
        id=preprod_artifact.project.organization_id
    )
    path = f"/organizations/{organization.slug}/explore/build/compare/{preprod_artifact.id}/{base_artifact.id}?project={preprod_artifact.project.slug}"
    return organization.absolute_url(path)
