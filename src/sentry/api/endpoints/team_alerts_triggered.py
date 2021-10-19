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


class TeamAlertsTriggeredEndpoint(TeamEndpoint, EnvironmentMixin):  # type: ignore
    def get(self, request, team) -> Response:
        """
        Return a time-bucketed (by day) count of triggered alerts owned by a given team.
        """
        project_list = Project.objects.get_for_team_ids([team.id])
        owner_ids = [team.actor_id] + list(team.member_set.values_list("user__actor_id", flat=True))
        start, end = get_date_range_from_params(request.GET)
        end = end.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
        start = start.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)

        bucketed_alert_counts = (
            IncidentActivity.objects.filter(
                (
                    Q(type=IncidentActivityType.CREATED.value)
                    | Q(
                        type=IncidentActivityType.STATUS_CHANGE.value,
                        value__in=[
                            IncidentStatus.OPEN,
                            IncidentStatus.CRITICAL,
                            IncidentStatus.WARNING,
                        ],
                    )
                ),
                incident__organization_id=team.organization_id,
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

        counts = {str(r["bucket"].isoformat()): r["count"] for r in bucketed_alert_counts}
        current_day = start
        while current_day < end:
            counts.setdefault(str(current_day.isoformat()), 0)
            current_day += timedelta(days=1)

        return Response(counts)
