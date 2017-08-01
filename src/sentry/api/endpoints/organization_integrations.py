from __future__ import absolute_import

from rest_framework import serializers
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.provider import ProviderSerializer
from sentry.exceptions import PluginError
from sentry.plugins import bindings


class IntegrationSerializer(serializers.Serializer):
    provider = serializers.CharField(max_length=64, required=True)
    defaultAuthId = serializers.IntegerField(required=False)
    integrationId = serializers.IntegerField(required=False)

    def validate(self, attrs):
        if not (attrs.get('defaultAuthId') or attrs.get('integrationId')):
            raise serializers.ValidationError(
                'You must either provide a defaultAuthId or an integrationId'
            )
        return attrs


class OrganizationIntegrationsEndpoint(OrganizationEndpoint):
    def has_feature(self, request, organization):
        return features.has(
            'organizations:integrations-v3',
            organization=organization,
            actor=request.user,
        )

    def get(self, request, organization):
        if not self.has_feature(request, organization):
            return Response({'detail': ['You do not have that feature enabled']}, status=400)

        # Right now, this is just repository providers, but in
        # theory we want it to also work for other types of plugins
        # in the future
        return Response(
            serialize(
                [
                    provider_cls(id=provider_id)
                    for provider_id, provider_cls in bindings.get('repository.provider').all()
                ],
                request.user,
                ProviderSerializer(organization)
            )
        )

    def post(self, request, organization):
        if not self.has_feature(request, organization):
            return Response({'detail': ['You do not have that feature enabled']}, status=400)

        serializer = IntegrationSerializer(data=request.DATA)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.object

        provider_id = result['provider']

        try:
            provider_cls = bindings.get('repository.provider').get(provider_id)
        except KeyError:
            return Response(
                {
                    'error_type': 'validation',
                }, status=400
            )

        provider = provider_cls(id=provider_id)

        try:
            # raise if they're trying to link an auth they
            # aren't allowed to
            provider.link_auth(
                request.user, organization, {
                    'default_auth_id': result.get('defaultAuthId'),
                    'integration_id': result.get('integrationId'),
                }
            )
        except PluginError as exc:
            return Response(
                {
                    'error_type': 'validation',
                    'message': exc.message,
                }, status=400
            )

        return Response(
            serialize(provider, request.user, ProviderSerializer(organization)), status=201
        )
