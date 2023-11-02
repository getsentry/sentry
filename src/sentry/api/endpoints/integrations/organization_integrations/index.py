from __future__ import annotations

from typing import Any, List, Mapping, Sequence

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.organization import OrganizationIntegrationsPermission
from sentry.api.bases.organization_integrations import OrganizationIntegrationBaseEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.integration import OrganizationIntegrationResponse
from sentry.apidocs.examples.integration_examples import IntegrationExamples
from sentry.apidocs.parameters import GlobalParams, IntegrationParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import ObjectStatus
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.services.hybrid_cloud.organization.model import (
    RpcOrganization,
    RpcUserOrganizationContext,
)


def prepare_feature_filters(features_raw: Sequence[str]) -> set[str]:
    """Normalize feature names from query params."""
    return {feature.lower().strip() for feature in features_raw}


def prepare_features(integration: Integration) -> set[str]:
    """Normalize feature names Integration provider feature lists."""

    return {feature.name.lower().strip() for feature in integration.get_provider().features}


def filter_by_features(
    organization_integrations: Sequence[OrganizationIntegration],
    feature_filters: Sequence[str],
) -> Sequence[OrganizationIntegration]:
    """Filter the list of organization integrations by feature."""
    return [
        organization_integration
        for organization_integration in organization_integrations
        if prepare_feature_filters(feature_filters).intersection(
            prepare_features(organization_integration.integration)
        )
    ]


@control_silo_endpoint
@extend_schema(tags=["Integrations"])
class OrganizationIntegrationsEndpoint(OrganizationIntegrationBaseEndpoint):
    owner = ApiOwner.ENTERPRISE
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (OrganizationIntegrationsPermission,)

    @extend_schema(
        operation_id="List an Organization's Available Integrations",
        parameters=[
            GlobalParams.ORG_SLUG,
            IntegrationParams.PROVIDER_KEY,
            IntegrationParams.FEATURES,
            IntegrationParams.INCLUDE_CONFIG,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ListOrganizationIntegrationResponse", List[OrganizationIntegrationResponse]
            ),
        },
        examples=IntegrationExamples.LIST_INTEGRATIONS,
    )
    def get(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
    ) -> Response:
        """
        Lists all the available Integrations for an Organization.
        """
        feature_filters = request.GET.getlist("features", [])
        # TODO: Remove provider_key in favor of ProviderKey after removing from frontend
        provider_key = request.GET.get("providerKey")
        if provider_key is None:
            provider_key = request.GET.get("provider_key", "")
        include_config_raw = request.GET.get("includeConfig")

        # Include the configurations by default if includeConfig is not present.
        # TODO(mgaeta): HACK. We need a consistent way to get booleans from query parameters.
        include_config = include_config_raw != "0"

        queryset = OrganizationIntegration.objects.filter(
            organization_id=organization.id,
            status__in=[
                ObjectStatus.ACTIVE,
                ObjectStatus.DISABLED,
                ObjectStatus.PENDING_DELETION,
            ],
        )
        if provider_key:
            queryset = queryset.filter(integration__provider=provider_key.lower())

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
