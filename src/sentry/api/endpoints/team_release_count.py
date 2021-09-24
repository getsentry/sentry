from datetime import timedelta

from django.db.models import Count
from django.db.models.functions import TruncDay
from django.utils import timezone

from rest_framework.response import Response

from sentry.api.base import EnvironmentMixin
from sentry.api.bases.team import TeamEndpoint
from sentry.api.serializers import GroupSerializer, serialize
from sentry.models import Group, GroupStatus, Project, Release


class TeamReleaseCountEndpoint(TeamEndpoint, EnvironmentMixin):
    def get(self, request, team):
        """
        Returns a dict of team projects, and a time-series list of release counts for each.
        """
        project_list = Project.objects.get_for_team_ids(team_ids=[team.id])
        # project_dict = {p.id: {'project':p, 'release_counts':[]} for p in project_list}

        bucketed_releases = Release.objects.filter(
            projects__in=project_list
        ).distinct().annotate(bucket=TruncDay("date_added"))
        print("s1:",bucketed_releases)
        bucketed_releases = bucketed_releases.values("projects","bucket")
        print("s2:",bucketed_releases)
        bucketed_releases = bucketed_releases.annotate(count=Count("id"))
        print("bucketed:", bucketed_releases)
        return Response(
            bucketed_releases
        )