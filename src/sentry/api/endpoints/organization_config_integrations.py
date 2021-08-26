from rest_framework.response import Response

from sentry import features, integrations
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import IntegrationProviderSerializer, serialize
from sentry.utils.compat import filter


class OrganizationConfigIntegrationsEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        def is_provider_enabled(provider):
            if not provider.requires_feature_flag:
                return True
            provider_key = provider.key.replace("_", "-")
            feature_flag_name = "organizations:integrations-%s" % provider_key
            return features.has(feature_flag_name, organization, actor=request.user)

        providers = filter(is_provider_enabled, list(integrations.all()))

        providers.sort(key=lambda i: i.key)

        serialized = serialize(
            providers, organization=organization, serializer=IntegrationProviderSerializer()
        )

        if "provider_key" in request.GET:
            serialized = [d for d in serialized if d["key"] == request.GET["provider_key"]]

        if not serialized:
            return Response({"detail": "Providers do not exist"}, status=404)

        return Response({"providers": serialized})
