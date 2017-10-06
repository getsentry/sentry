from __future__ import absolute_import

from sentry import features
from sentry.api.bases.organization import (
    OrganizationEndpoint, OrganizationIntegrationsPermission
)
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import Integration


class OrganizationIntegrationsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationIntegrationsPermission, )

    def has_feature(self, request, organization):
        return features.has(
            'organizations:integrations-v3',
            organization=organization,
            actor=request.user,
        )

    def get(self, request, organization):
        if not self.has_feature(request, organization):
            return self.respond({'detail': ['You do not have that feature enabled']}, status=400)

        return self.paginate(
            queryset=Integration.objects.filter(organizations=organization),
            request=request,
            order_by='name',
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )
