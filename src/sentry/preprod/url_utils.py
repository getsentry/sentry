from __future__ import annotations

from typing import Literal

from sentry.models.organization import Organization
from sentry.preprod.models import PreprodArtifact

ViewType = Literal["size", "snapshots", "install"]


def get_preprod_artifact_url(
    preprod_artifact: PreprodArtifact, view_type: ViewType = "size"
) -> str:
    """
    Build a region/customer-domain aware absolute URL for the preprod artifact UI.
    """
    organization: Organization = Organization.objects.get_from_cache(
        id=preprod_artifact.project.organization_id
    )

    path = f"/organizations/{organization.slug}/preprod/{view_type}/{preprod_artifact.id}"
    return organization.absolute_url(path)


def get_preprod_artifact_comparison_url(
    preprod_artifact: PreprodArtifact,
    base_artifact: PreprodArtifact,
    comparison_type: ViewType = "size",
) -> str:
    """
    Build a region/customer-domain aware absolute URL for the preprod artifact comparison UI.
    """
    organization: Organization = Organization.objects.get_from_cache(
        id=preprod_artifact.project.organization_id
    )
    if comparison_type == "snapshots":
        path = f"/organizations/{organization.slug}/preprod/{comparison_type}/{preprod_artifact.id}"
    else:
        path = f"/organizations/{organization.slug}/preprod/{comparison_type}/compare/{preprod_artifact.id}/{base_artifact.id}"

    return organization.absolute_url(path)
