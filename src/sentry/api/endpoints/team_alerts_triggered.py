from datetime import timedelta

from django.db.models import Count, Q
from django.db.models.functions import TruncDay
from rest_framework.response import Response

from sentry.api.base import EnvironmentMixin
from sentry.api.bases.team import TeamEndpoint
from sentry.api.utils import get_date_range_from_params
from sentry.incidents.models import (
    IncidentActivity,
    IncidentActivityType,
    IncidentProject,
    IncidentStatus,
)
from sentry.models import Project


class TeamAlertsTriggeredEndpoint(TeamEndpoint, EnvironmentMixin):
    def get(self, request, team):
        """
        Return a time-bucketed (by day) count of triggered alerts owned by a given team.
        """
        project_list = Project.objects.get_for_team_ids([team.id])
        owner_ids = [team.actor_id] + [om.user.actor_id for om in team.member_set]
        start, end = get_date_range_from_params(request.GET)
        bucketed_alert_counts = (
            IncidentActivity.objects.filter(
                (
                    Q(type=IncidentActivityType.CREATED.value)
                    | Q(
                        type=IncidentActivityType.STATUS_CHANGE.value,
                        value__in=[
                            None,
                            IncidentStatus.OPEN,
                            IncidentStatus.CRITICAL,
                            IncidentStatus.WARNING,
                        ],
                    )
                ),
                incident__alert_rule__owner__in=owner_ids,
                incident_id__in=IncidentProject.objects.filter(project__in=project_list).values(
                    "incident_id"
                ),
                date_added__gte=start,
                date_added__lte=end,
            )
            .annotate(bucket=TruncDay("date_added"))
            .values("bucket")
            .annotate(count=Count("id"))
        )

        counts = {str(r["bucket"].replace(tzinfo=None)): r["count"] for r in bucketed_alert_counts}
        current_day = start.replace(
            hour=0, minute=0, second=0, microsecond=0, tzinfo=None
        ) + timedelta(days=1)
        end_day = end.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
        while current_day <= end_day:
            key = str(current_day)
            if key not in counts:
                counts[key] = 0
            current_day += timedelta(days=1)

        return Response(counts)
