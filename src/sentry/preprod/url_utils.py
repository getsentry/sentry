from __future__ import annotations

from sentry.models.organization import Organization


def get_preprod_artifact_url(organization_id: int, project_slug: str, artifact_id: str) -> str:
    """
    Build a region/customer-domain aware absolute URL for the preprod artifact UI.
    """
    organization: Organization = Organization.objects.get_from_cache(id=organization_id)

    path = f"/organizations/{organization.slug}/preprod/{project_slug}/{artifact_id}"
    return organization.absolute_url(path)
