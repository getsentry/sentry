from __future__ import absolute_import

from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.provider import ProviderSerializer
from sentry.exceptions import PluginError
from sentry.plugins import bindings


class IntegrationSerializer(serializers.Serializer):
    providerId = serializers.CharField(max_length=64, required=True)
    defaultAuthId = serializers.CharField(max_length=64, required=False)
    # TODO(jess): actually make this work with gh integrations
    integrationId = serializers.CharField(max_length=64, required=False)

    def validate(self, attrs):
        if not attrs.get('defaultAuthId') or attrs.get('integrationId'):
            raise serializers.ValidationError(
                'You must either provide a defaultAuthId or an integrationId'
            )
        return attrs


class OrganizationIntegrationsEndpoint(OrganizationEndpoint):

    def get(self, request, organization):
        results = []
        # Right now, this is just repository providers, but in
        # theory we want it to also work for other types of plugins
        # in the future
        for provider_id, provider_cls in bindings.get('repository.provider').all():
            provider = provider_cls(id=provider_id)

            results.append(
                serialize(
                    provider,
                    request.user,
                    ProviderSerializer(organization)
                )
            )

        return Response(results)

    def post(self, request, organization):
        serializer = IntegrationSerializer(data=request.DATA)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.object

        provider_id = result['providerId']

        try:
            provider_cls = bindings.get(
                'repository.provider'
            ).get(provider_id)
        except KeyError:
            return Response({
                'error_type': 'validation',
            }, status=400)

        provider = provider_cls(id=provider_id)

        try:
            # raise if they're trying to link an auth they
            # aren't allowed to
            provider.link_auth(
                request.user,
                organization,
                {'default_auth_id': result['defaultAuthId']}
            )
        except PluginError:
            return Response({
                'error_type': 'validation',
            }, status=400)

        return Response(
            serialize(
                provider,
                request.user,
                ProviderSerializer(organization)
            ), status=201
        )
