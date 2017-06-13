from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse
from django.db import IntegrityError, transaction

from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.provider import ProviderSerializer
from sentry.exceptions import PluginError
from sentry.plugins import bindings
from sentry.models import Installation, Repository


class OrganizationInstallationEndpoint(OrganizationEndpoint):

    def get(self, request, organization):
        results = []
        for provider_id, provider_cls in bindings.get('repository.provider').all():
            provider = provider_cls(id=provider_id)

            if not provider.has_installations:
                continue

            if provider.needs_auth(request.user, for_installation=True):
                return Response({
                    'error_type': 'auth',
                    'title': provider.name,
                    'auth_url': reverse('socialauth_associate', args=[
                        provider.installation_auth_provider or provider.auth_provider]),
                }, status=400)

            results.append(
                serialize(
                    provider,
                    request.user,
                    ProviderSerializer(organization)
                )
            )

        return Response(results)

    def post(self, request, organization):
        # TODO(jess): validation
        provider_id = request.DATA.get('provider')
        installation_id = request.DATA.get('installationId')

        try:
            provider_cls = bindings.get('repository.provider').get(provider_id)
        except KeyError:
            return Response({
                'error_type': 'validation',
            }, status=400)

        provider = provider_cls(id=provider_id)

        try:
            installations = provider.get_installations(request.user)
        except PluginError as e:
            return Response({
                'errors': {'__all__': e.message},
            }, status=400)

        installations = {
            six.text_type(i['installation_id']): i for i in
            installations
        }

        try:
            installation = installations[installation_id]
        except KeyError:
            # They don't have access
            return Response({
                'error_type': 'validation',
            }, status=400)

        try:
            installation = Installation.objects.get(
                installation_id=installation_id,
            )
        except Installation.DoesNotExist:
            # they need to install via provider first
            # this maybe should never happen though
            return Response({
                'error_type': 'validation',
            }, status=400)

        installation.add_organization(organization)

        try:
            repositories = provider.get_repositories(installation)
        except PluginError as e:
            return Response({
                'errors': {'__all__': e.message},
            }, status=400)

        for repo in repositories:
            try:
                with transaction.atomic():
                    Repository.objects.create(organization_id=organization.id, **repo)
            except IntegrityError:
                pass

        return Response(
            serialize(
                provider,
                request.user,
                ProviderSerializer(organization)
            ), status=201
        )
