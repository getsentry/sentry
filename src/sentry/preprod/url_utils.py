from __future__ import annotations
from typing import int

from sentry.models.organization import Organization
from sentry.preprod.models import PreprodArtifact


def get_preprod_artifact_url(preprod_artifact: PreprodArtifact) -> str:
    """
    Build a region/customer-domain aware absolute URL for the preprod artifact UI.
    """
    organization: Organization = Organization.objects.get_from_cache(
        id=preprod_artifact.project.organization_id
    )

    path = f"/organizations/{organization.slug}/preprod/{preprod_artifact.project.slug}/{preprod_artifact.id}"
    return organization.absolute_url(path)


def get_preprod_artifact_comparison_url(
    preprod_artifact: PreprodArtifact, base_artifact: PreprodArtifact
) -> str:
    """
    Build a region/customer-domain aware absolute URL for the preprod artifact comparison UI.
    """
    organization: Organization = Organization.objects.get_from_cache(
        id=preprod_artifact.project.organization_id
    )
    path = f"/organizations/{organization.slug}/preprod/{preprod_artifact.project.slug}/compare/{preprod_artifact.id}/{base_artifact.id}"
    return organization.absolute_url(path)
