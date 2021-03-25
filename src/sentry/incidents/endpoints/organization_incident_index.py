from sentry import features
from sentry.api.bases.incident import IncidentPermission
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.incident import IncidentSerializer
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

        query_alert_rule = request.GET.get("alertRule")
        if query_alert_rule is not None:
            incidents = incidents.filter(alert_rule=query_alert_rule)

        query_start = request.GET.get("start")
        if query_start is not None:
            # exclude incidents closed before the window
            incidents = incidents.exclude(date_closed__lt=query_start)

        query_end = request.GET.get("end")
        if query_end is not None:
            # exclude incidents started after the window
            incidents = incidents.exclude(date_started__gt=query_end)

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

        expand = request.GET.getlist("expand", [])

        return self.paginate(
            request,
            queryset=incidents,
            order_by="-date_started",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user, IncidentSerializer(expand=expand)),
            default_per_page=25,
        )
