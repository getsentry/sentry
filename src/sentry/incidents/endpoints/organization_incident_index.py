from __future__ import absolute_import

from sentry import features
from sentry.api.bases.incident import IncidentPermission
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.incidents.models import Incident, IncidentStatus
from sentry.snuba.dataset import Dataset


class OrganizationIncidentIndexEndpoint(OrganizationEndpoint):
    permission_classes = (IncidentPermission,)

    def get(self, request, organization):
        """
        List Incidents that a User can access within an Organization
        ````````````````````````````````````````````````````````````
        Returns a paginated list of Incidents that a user can access.

        :auth: required
        """
        if not features.has("organizations:incidents", organization, actor=request.user):
            raise ResourceDoesNotExist

        incidents = Incident.objects.fetch_for_organization(
            organization, self.get_projects(request, organization)
        )

        envs = self.get_environments(request, organization)
        if envs:
            incidents = incidents.filter(alert_rule__snuba_query__environment__in=envs)

        query_status = request.GET.get("status")
        if query_status is not None:
            if query_status == "open":
                incidents = incidents.exclude(status=IncidentStatus.CLOSED.value)
            elif query_status == "warning":
                incidents = incidents.filter(status=IncidentStatus.WARNING.value)
            elif query_status == "critical":
                incidents = incidents.filter(status=IncidentStatus.CRITICAL.value)
            elif query_status == "closed":
                incidents = incidents.filter(status=IncidentStatus.CLOSED.value)

        if not features.has("organizations:performance-view", organization):
            # Filter to only error alerts
            incidents = incidents.filter(alert_rule__snuba_query__dataset=Dataset.Events.value)

        return self.paginate(
            request,
            queryset=incidents,
            order_by="-date_started",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
            default_per_page=25,
        )
