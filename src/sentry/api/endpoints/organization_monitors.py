from __future__ import absolute_import

from sentry import features
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import Monitor


class OrganizationMonitorsEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        """
        Retrieve monitors for an organization
        `````````````````````````````````````

        :pparam string organization_slug: the slug of the organization
        :auth: required
        """
        if not features.has('organizations:monitors',
                            organization, actor=request.user):
            raise ResourceDoesNotExist

        queryset = Monitor.objects.filter(
            organization_id=organization.id,
        )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='name',
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )
