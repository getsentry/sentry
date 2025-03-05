from dateutil.parser import parse as parse_date
from django.db.models import Q
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.incident import IncidentPermission
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.exceptions import InvalidParams
from sentry.incidents.endpoints.serializers.incident import IncidentSerializer
from sentry.incidents.models.alert_rule import AlertRuleActivity, AlertRuleActivityType
from sentry.incidents.models.incident import Incident, IncidentStatus
from sentry.snuba.dataset import Dataset
from sentry.utils.dates import ensure_aware

from .utils import parse_team_params


@region_silo_endpoint
class OrganizationIncidentIndexEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (IncidentPermission,)

    def get(self, request: Request, organization) -> Response:
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
            query_alert_rule_id = int(query_alert_rule)
            alert_rule_ids = [query_alert_rule_id]
            if query_include_snapshots:
                snapshot_alerts = list(
                    AlertRuleActivity.objects.filter(
                        previous_alert_rule=query_alert_rule_id,
                        type=AlertRuleActivityType.SNAPSHOT.value,
                    )
                )
                for snapshot_alert in snapshot_alerts:
                    alert_rule_ids.append(snapshot_alert.alert_rule_id)
            incidents = incidents.filter(alert_rule__in=alert_rule_ids)

        query_start_s = request.GET.get("start")
        if query_start_s is not None:
            # exclude incidents closed before the window
            query_start = ensure_aware(parse_date(query_start_s))
            incidents = incidents.exclude(date_closed__lt=query_start)

        query_end_s = request.GET.get("end")
        if query_end_s is not None:
            # exclude incidents started after the window
            query_end = ensure_aware(parse_date(query_end_s))
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

            team_filter_query = Q(alert_rule__team_id__in=teams_query.values_list("id", flat=True))
            if unassigned:
                team_filter_query = team_filter_query | Q(alert_rule__team_id__isnull=True)

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
