from __future__ import absolute_import

from rest_framework.response import Response

from sentry import features
from sentry.auth import manager
from sentry.auth.providers.saml2 import SAML2Provider, HAS_SAML2
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationAdminPermission
from sentry.api.serializers import serialize


class OrganizationAuthProvidersEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationAdminPermission, )

    def get(self, request, organization):
        """
        List available auth providers that are available to use for an Organization
        ```````````````````````````````````````````````````````````````````````````

        :pparam string organization_slug: the organization short name
        :auth: required
        """
        provider_list = []
        for k, v in manager:
            if issubclass(v, SAML2Provider) and not HAS_SAML2:
                continue

            feature = v.required_feature
            if feature and not features.has(feature, organization, actor=request.user):
                continue

            provider_list.append((k, v.name))

        return Response(serialize(provider_list, request.user))
