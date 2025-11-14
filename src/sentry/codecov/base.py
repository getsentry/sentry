from __future__ import annotations
from typing import int

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

        try:
            owner_id = int(owner)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            raise ResourceDoesNotExist

        if owner_id and organization:
            integration = integration_service.get_integration(
                provider=IntegrationProviderSlug.GITHUB,
                integration_id=owner_id,
                organization_id=organization.id,
            )
            if not integration:
                raise ResourceDoesNotExist

        request._request.integration = integration  # type: ignore[attr-defined]

        # Note: Currently we will allow all users to access all the repos of the org.
        # We might want to add a permission check for the repos that the user have access to in the future.

        parsed_kwargs["owner"] = integration
        return (parsed_args, parsed_kwargs)
