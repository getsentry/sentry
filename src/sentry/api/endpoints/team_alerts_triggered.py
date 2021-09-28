from django.db.models import Count
from django.db.models.functions import TruncDay
from rest_framework.response import Response

from sentry.api.base import EnvironmentMixin
from sentry.api.bases.team import TeamEndpoint
from sentry.api.utils import get_date_range_from_params
from sentry.incidents.models import IncidentActivity, IncidentActivityType, IncidentStatus
from sentry.models import Project


class TeamAlertsTriggeredEndpoint(TeamEndpoint, EnvironmentMixin):
    def get(self, request, team):
        """
        Return a time-bucketed (by day) count of triggered alerts owned by a given team.
        """
        project_list = Project.objects.get_for_team_ids([team.id])
        owner_ids = [team.actor_id] + [om.user.actor_id for om in team.member_set]
        start, end = get_date_range_from_params(request.GET)
        bucketed_alert_counts = list(
            IncidentActivity.objects.filter(
                type__in=[
                    IncidentActivityType.CREATED.value,
                    IncidentActivityType.STATUS_CHANGE.value,
                ],
                value__in=[
                    None,
                    IncidentStatus.OPEN,
                    IncidentStatus.CRITICAL,
                    IncidentStatus.WARNING,
                ],
                incident__alert_rule__owner__in=owner_ids,
                incident__projects__in=project_list,
                date_added__gte=start,
                date_added__lte=end,
            )
            .annotate(bucket=TruncDay("date_added"))
            .values("bucket")
            .annotate(count=Count("id"))
        )

        return Response(bucketed_alert_counts)
