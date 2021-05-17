from django.db.models import Q
from rest_framework import status
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.incident import IncidentPermission
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.incident import IncidentSerializer
from sentry.api.utils import InvalidParams
from sentry.incidents.models import (
    AlertRuleActivity,
    AlertRuleActivityType,
    Incident,
    IncidentStatus,
)
from sentry.snuba.dataset import Dataset

from .utils import parse_team_params


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

        title = request.GET.get("title", None)
        expand = request.GET.getlist("expand", [])
        query_alert_rule = request.GET.get("alertRule")
        query_include_snapshots = request.GET.get("includeSnapshots")
        if query_alert_rule is not None:
            alert_rule_ids = [int(query_alert_rule)]
            if query_include_snapshots:
                snapshot_alerts = list(
                    AlertRuleActivity.objects.filter(
                        previous_alert_rule=query_alert_rule,
                        type=AlertRuleActivityType.SNAPSHOT.value,
                    )
                )
                for snapshot_alert in snapshot_alerts:
                    alert_rule_ids.append(snapshot_alert.alert_rule_id)
            incidents = incidents.filter(alert_rule__in=alert_rule_ids)

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

        teams = request.GET.getlist("team", [])
        if len(teams) > 0:
            try:
                teams_query, unassigned = parse_team_params(request, organization, teams)
            except InvalidParams as err:
                return Response(str(err), status=status.HTTP_400_BAD_REQUEST)

            team_filter_query = Q(
                alert_rule__owner_id__in=teams_query.values_list("actor_id", flat=True)
            )
            if unassigned:
                team_filter_query = team_filter_query | Q(alert_rule__owner_id=None)

            incidents = incidents.filter(team_filter_query)

        if title:
            incidents = incidents.filter(Q(title__icontains=title))

        if not features.has("organizations:performance-view", organization):
            # Filter to only error alerts
            incidents = incidents.filter(alert_rule__snuba_query__dataset=Dataset.Events.value)

        return self.paginate(
            request,
            queryset=incidents,
            order_by="-date_started",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user, IncidentSerializer(expand=expand)),
            default_per_page=25,
        )
