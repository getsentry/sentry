from __future__ import absolute_import

from rest_framework.response import Response

from sentry import features
from sentry.auth import manager
from sentry.auth.providers.saml2 import SAML2Provider, HAS_SAML2
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationAuthProvidersPermission
from sentry.api.serializers import serialize


class OrganizationAuthProvidersEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationAuthProvidersPermission, )

    def get(self, request, organization):
        """
        List an Organization's auth providers
        ```````````````````````````````````

        :pparam string organization_slug: the organization short name
        :auth: required
        """
        provider_list = []
        for k, v in manager:
            if issubclass(v, SAML2Provider):
                if not HAS_SAML2:
                    continue
                if not features.has('organizations:saml2', organization, actor=request.user):
                    continue
            provider_list.append((k, v.name))

        return Response(serialize(provider_list, request.user))
