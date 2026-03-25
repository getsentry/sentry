from typing import TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST
from sentry.apidocs.examples.integration_examples import IntegrationExamples
from sentry.apidocs.parameters import GlobalParams, IntegrationParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.integrations.api.serializers.models.integration import (
    IntegrationProviderResponse,
    IntegrationProviderSerializer,
)
from sentry.integrations.base import is_provider_enabled
from sentry.integrations.manager import default_manager as integrations
from sentry.models.organization import Organization


class OrganizationConfigIntegrationsEndpointResponse(TypedDict):
    providers: list[IntegrationProviderResponse]


@extend_schema(tags=["Integrations"])
@cell_silo_endpoint
class OrganizationConfigIntegrationsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Get Integration Provider Information",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            IntegrationParams.PROVIDER_KEY,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationConfigIntegrationsEndpointResponse",
                OrganizationConfigIntegrationsEndpointResponse,
            ),
            404: RESPONSE_BAD_REQUEST,
        },
        examples=IntegrationExamples.ORGANIZATION_CONFIG_INTEGRATIONS,
    )
    def get(self, request: Request, organization: Organization) -> Response:
        """
        Get integration provider information about all available integrations for an organization.
        """

        providers = list(integrations.all())
        provider_key = request.GET.get("provider_key") or request.GET.get("providerKey")
        if provider_key:
            providers = [p for p in providers if p.key == provider_key]

        providers = list(filter(lambda p: is_provider_enabled(p, organization), providers))

        providers.sort(key=lambda i: i.key)

        serialized = serialize(
            providers, organization=organization, serializer=IntegrationProviderSerializer()
        )

        if not serialized:
            return Response({"detail": "Providers do not exist"}, status=404)

        return Response({"providers": serialized})
