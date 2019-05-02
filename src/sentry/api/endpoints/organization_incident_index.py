from __future__ import absolute_import

from sentry import features
from sentry.api.bases.organization import (
    OrganizationEndpoint,
    OrganizationPermission,
)
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.incidents.models import Incident


class OrganizationIncidentPermission(OrganizationPermission):
    scope_map = {
        'GET': ['org:read', 'org:write', 'org:admin'],
        'POST': ['org:write', 'org:admin'],
    }


class OrganizationIncidentIndexEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationIncidentPermission, )

    def get(self, request, organization):
        """
        List Incidents that a User can access within an Organization
        ````````````````````````````````````````````````````````````
        Returns a paginated list of Incidents that a user can access.

        :auth: required
        """
        if not features.has('organizations:incidents', organization, actor=request.user):
            return self.respond(status=404)

        incidents = Incident.objects.fetch_for_organization(
            organization,
            self.get_projects(request, organization),
        )

        return self.paginate(
            request,
            queryset=incidents,
            order_by='date_started',
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )
