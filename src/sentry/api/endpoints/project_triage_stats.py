from __future__ import absolute_import

from rest_framework.response import Response

from datetime import timedelta
from django.utils import timezone

from sentry.api.bases.project import ProjectEndpoint
from sentry.models import Group, GroupStatus, Activity
from sentry.utils.dates import to_timestamp


class TriageStatus(GroupStatus):
    DNE = -1
    ASSIGNED = 6


class ProjectTriageStatsEndpoint(ProjectEndpoint):

    def filter_activity_set(self, set, cutoff):
        return [ai for ai in set if ai['datetime'] < cutoff]

    def process_activity_set(self, group, dates):

        activity_set = list(Activity.objects.filter(
            type__in=[Activity.SET_RESOLVED, Activity.SET_RESOLVED_IN_RELEASE,
                      Activity.SET_RESOLVED_BY_AGE, Activity.SET_RESOLVED_IN_COMMIT, Activity.SET_UNRESOLVED, Activity.SET_REGRESSION, Activity.SET_IGNORED, Activity.ASSIGNED, Activity.UNASSIGNED],
            group=group[0]).order_by('datetime').values('type', 'datetime'))

        status = GroupStatus.UNRESOLVED
        statuses = []
        seen_activities = 0
        for date in dates:
            ts = int(to_timestamp(date))
            if date < group[1]:
                statuses.append({'timestamp': ts, 'status': TriageStatus.DNE})
                continue
            sliced = self.filter_activity_set(
                activity_set[seen_activities:], date)

            for activity in sliced:
                seen_activities += 1
                if activity['type'] in set([Activity.SET_RESOLVED, Activity.SET_RESOLVED_IN_RELEASE,
                                            Activity.SET_RESOLVED_BY_AGE, Activity.SET_RESOLVED_IN_COMMIT]):
                    status = GroupStatus.RESOLVED

                elif activity['type'] in set([Activity.SET_UNRESOLVED, Activity.SET_REGRESSION]):
                    status = GroupStatus.UNRESOLVED

                elif activity['type'] is Activity.SET_IGNORED:
                    status = GroupStatus.IGNORED

                elif activity['type'] is Activity.ASSIGNED:
                    if status == GroupStatus.UNRESOLVED:
                        status = TriageStatus.ASSIGNED

                elif activity['type'] is Activity.UNASSIGNED:
                    if status == TriageStatus.ASSIGNED:
                        prev_statuses = filter(
                            lambda s: s['status'] != TriageStatus.ASSIGNED, statuses)
                        if len(prev_statuses) == 0:
                            prev_statuses = [
                                {'status': GroupStatus.UNRESOLVED}]
                        status = prev_statuses[-1]['status']
                else:
                    pass

            statuses.append({'timestamp': ts, 'status': status})

        return statuses

    def get(self, request, project):

        now = timezone.now()
        dates = [now - timedelta(days=i) for i in range(30)]

        groups = Group.objects.filter(
            project=project.id,
            last_seen__gte=now - timedelta(days=30)
        ).values_list('id', 'first_seen')

        processed_groups = [self.process_activity_set(
            group, dates) for group in groups]

        stat_table = {int(to_timestamp(date)): {} for date in dates}

        for pg in processed_groups:
            for data_point in pg:

                status = data_point['status']
                ov = stat_table[data_point['timestamp']].get(status, 0)
                stat_table[data_point['timestamp']][status] = ov + 1

        return Response(stat_table)
