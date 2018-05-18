from __future__ import absolute_import

from sentry.api.bases.organization import (
    OrganizationEndpoint, OrganizationIntegrationsPermission
)
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import Integration


class OrganizationIntegrationsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationIntegrationsPermission, )

    def get(self, request, organization):
        integrations = Integration.objects.filter(organizations=organization)

        if 'provider_key' in request.GET:
            integrations = integrations.filter(provider=request.GET['provider_key'])

        return self.paginate(
            queryset=integrations,
            request=request,
            order_by='name',
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )
