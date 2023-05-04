from __future__ import annotations

from typing import Sequence

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationIntegrationsPermission
from sentry.api.serializers import serialize
from sentry.api.serializers.models.integration import OrganizationIntegrationSerializer
from sentry.models import ObjectStatus, Organization, OrganizationIntegration
from sentry.services.hybrid_cloud.integration import RpcIntegration, integration_service
from sentry.services.hybrid_cloud.pagination import RpcPaginationArgs


def prepare_feature_filters(features_raw: Sequence[str]) -> set[str]:
    """Normalize feature names from query params."""
    return {feature.lower().strip() for feature in features_raw}


def prepare_features(
    integration: RpcIntegration,
) -> set[str]:
    """Normalize feature names Integration provider feature lists."""

    return {feature.name.lower().strip() for feature in integration.get_provider().features}


def filter_by_features(
    organization_integrations: Sequence[OrganizationIntegration],
    feature_filters: Sequence[str],
) -> Sequence[OrganizationIntegration]:
    """Filter the list of organization integrations by feature."""
    integrations = integration_service.get_integrations(
        integration_ids=[oi.integration_id for oi in organization_integrations]
    )
    integrations_by_id = {i.id: i for i in integrations}

    return [
        organization_integration
        for organization_integration in organization_integrations
        if prepare_feature_filters(feature_filters).intersection(
            prepare_features(integrations_by_id.get(organization_integration.integration_id))
        )
    ]


@region_silo_endpoint
class OrganizationIntegrationsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationIntegrationsPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        """
        List the available Integrations for an Organization
        ```````````````````````````````````````````````````

        :pparam string organization_slug: The slug of the organization.

        :qparam string provider_key: Filter by specific integration provider. (e.g. "slack")
        :qparam string[] features: Filter by integration features names.
        :qparam bool includeConfig: Should integrations configurations be fetched from third-party
            APIs? This can add several seconds to the request round trip.

        :auth: required
        """
        feature_filters = request.GET.getlist("features", [])
        provider_key = request.GET.get("provider_key", "")
        include_config_raw = request.GET.get("includeConfig")

        # Include the configurations by default if includeConfig is not present.
        # TODO(mgaeta): HACK. We need a consistent way to get booleans from query parameters.
        include_config = include_config_raw != "0"

        pagination_result = integration_service.page_organization_integrations_ids(
            organization_id=organization.id,
            statuses=[
                ObjectStatus.ACTIVE,
                ObjectStatus.DISABLED,
                ObjectStatus.PENDING_DELETION,
            ],
            provider_key=provider_key,
            args=RpcPaginationArgs.from_endpoint_request(self, request),
        )
        results = integration_service.get_organization_integrations(
            org_integration_ids=pagination_result.ids
        )

        if feature_filters:
            results = filter_by_features(results, feature_filters)

        response = Response(
            serialize(
                results,
                user=request.user,
                include_config=include_config,
                serializer=OrganizationIntegrationSerializer(),
            )
        )
        self.add_cursor_headers(request, response, pagination_result)
        return response
