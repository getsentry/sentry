from __future__ import annotations

from rest_framework.request import Request

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug


class CodecovEndpoint(OrganizationEndpoint):
    """
    Used for endpoints that are specific to Codecov / Prevent. These endpoints are region-scoped.
    """

    def convert_args(self, request: Request, *args, **kwargs):
        # Check and validate the organization
        parsed_args, parsed_kwargs = super().convert_args(request, *args, **kwargs)

        owner = parsed_kwargs.get("owner")
        organization = parsed_kwargs.get("organization")

        if owner and organization:
            integration = integration_service.get_integration(
                provider=IntegrationProviderSlug.GITHUB,
                external_id=owner,
                organization_id=organization.id,
            )
            if not integration:
                raise ResourceDoesNotExist

        # Note: Currently we will allow all users to access all the repos of the org.
        # We might want to add a permission check for the repos that the user have acces to in the future.

        return (parsed_args, parsed_kwargs)
