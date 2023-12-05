from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, integrations
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.integration import IntegrationProviderSerializer


@region_silo_endpoint
class OrganizationConfigIntegrationsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, organization) -> Response:
        def is_provider_enabled(provider):
            if not provider.requires_feature_flag:
                return True
            provider_key = provider.key.replace("_", "-")
            feature_flag_name = "organizations:integrations-%s" % provider_key
            return features.has(feature_flag_name, organization, actor=request.user)

        providers = list(filter(is_provider_enabled, list(integrations.all())))

        providers.sort(key=lambda i: i.key)

        serialized = serialize(
            providers, organization=organization, serializer=IntegrationProviderSerializer()
        )

        if "provider_key" in request.GET:
            serialized = [d for d in serialized if d["key"] == request.GET["provider_key"]]

        if not serialized:
            return Response({"detail": "Providers do not exist"}, status=404)

        return Response({"providers": serialized})
