from django.db.models import Count
from django.db.models.functions import TruncDay
from rest_framework.response import Response

from sentry.api.base import EnvironmentMixin
from sentry.api.bases.team import TeamEndpoint
from sentry.incidents.models import IncidentTrigger, TriggerStatus
from sentry.models import Project


class TeamAlertsTriggeredEndpoint(TeamEndpoint, EnvironmentMixin):
    def get(self, request, team):
        """
        Return a time-bucketed (by day) count of triggered alerts owned by a given team.
        """
        # TODO: Accept time range. Default to 8 weeks, max 12 weeks. Not sure how yet. start/end? statsPeriod?
        project_list = Project.objects.get_for_team_ids([team.id])
        owner_ids = [team.actor_id] + [om.user.actor_id for om in team.member_set]
        # TODO: wanted to understand better why this wasnt working
        # bucketed_alert_counts = IncidentTrigger.objects.filter(status=TriggerStatus.ACTIVE.value, incident__alert_rule__owner__in=owner_ids).annotate(bucket=TruncDay('date_added')).annotate(count=Count('id')).values('bucket', 'count')
        # print(bucketed_alert_counts.query)
        bucketed_alert_counts = list(
            IncidentTrigger.objects.filter(
                status=TriggerStatus.ACTIVE.value,
                incident__alert_rule__owner__in=owner_ids,
                incident__projects__in=project_list,
            )
            .annotate(bucket=TruncDay("date_added"))
            .values("bucket")
            .annotate(count=Count("id"))
        )

        return Response(bucketed_alert_counts)
