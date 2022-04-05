from __future__ import annotations

from typing import Any, Mapping, Sequence

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint, OrganizationIntegrationsPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import ObjectStatus, Organization, OrganizationIntegration


def prepare_feature_filters(features_raw: Sequence[str]) -> set[str]:
    """Normalize feature names from query params."""
    return {feature.lower().strip() for feature in features_raw}


def prepare_features(organization_integration: OrganizationIntegration) -> set[str]:
    """Normalize feature names Integration provider feature lists."""
    return {
        feature.name.lower().strip()
        for feature in organization_integration.integration.get_provider().features
    }


def filter_by_features(
    organization_integrations: Sequence[OrganizationIntegration],
    feature_filters: Sequence[str],
) -> Sequence[OrganizationIntegration]:
    """Filter the list of organization integrations by feature."""
    return [
        organization_integration
        for organization_integration in organization_integrations
        if prepare_feature_filters(feature_filters).intersection(
            prepare_features(organization_integration)
        )
    ]


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

        # Show disabled organization integrations but not the ones currently
        # undergoing deletion.
        queryset = OrganizationIntegration.objects.filter(
            organization=organization,
            status__in=[
                ObjectStatus.VISIBLE,
                ObjectStatus.DISABLED,
                ObjectStatus.PENDING_DELETION,
            ],
        )

        if provider_key:
            queryset = queryset.filter(integration__provider=provider_key.lower())

        # Include the configurations by default if includeConfig is not present.
        # TODO(mgaeta): HACK. We need a consistent way to get booleans from query parameters.
        include_config = include_config_raw != "0"

        def on_results(results: Sequence[OrganizationIntegration]) -> Sequence[Mapping[str, Any]]:
            if feature_filters:
                results = filter_by_features(results, feature_filters)
            return serialize(results, request.user, include_config=include_config)

        return self.paginate(
            queryset=queryset,
            request=request,
            order_by="integration__name",
            on_results=on_results,
            paginator_cls=OffsetPaginator,
        )
