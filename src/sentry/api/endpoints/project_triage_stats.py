from __future__ import absolute_import

from rest_framework.response import Response

from datetime import timedelta
from django.utils import timezone

from sentry.api.bases.project import ProjectEndpoint
# from sentry.api.serializers import serialize
from sentry.models import Group, GroupStatus, Activity  # GroupResolution, GroupSeen,
from sentry.utils.dates import to_timestamp


class TriageStatus(GroupStatus):
    DNE = -1
    ASSIGNED = 6


class ProjectTriageStatsEndpoint(ProjectEndpoint):

    def filterActivitySet(self, set, cutoff):
        return [ai for ai in set if ai.datetime < cutoff]

    def processSet(self, group, dates):

        activity_set = group.activity_set.all()

        status = GroupStatus.UNRESOLVED
        statuses = []
        for date in dates:
            ts = int(to_timestamp(date))
            if date < group.first_seen:
                statuses.append({'timestamp': ts, 'status': TriageStatus.DNE})
                continue
            sliced = self.filterActivitySet(activity_set, date)

            for activity in sliced:
                if activity.type in set([Activity.SET_RESOLVED, Activity.SET_RESOLVED_IN_RELEASE,
                                         Activity.SET_RESOLVED_BY_AGE, Activity.SET_RESOLVED_IN_COMMIT]):
                    status = GroupStatus.RESOLVED

                elif activity.type in set([Activity.SET_UNRESOLVED, Activity.SET_REGRESSION]):
                    status = GroupStatus.UNRESOLVED

                elif activity.type is Activity.SET_IGNORED:
                    status = GroupStatus.IGNORED

                elif activity.type is Activity.ASSIGNED:
                    if status == GroupStatus.UNRESOLVED:
                        status = TriageStatus.ASSIGNED

                elif activity.type is Activity.UNASSIGNED:
                    if status == TriageStatus.ASSIGNED:
                        prev_statuses = filter(
                            lambda s: s['status'] != TriageStatus.ASSIGNED, statuses)
                        if len(prev_statuses) == 0:
                            prev_statuses = [
                                {'status': GroupStatus.UNRESOLVED}]
                        status = prev_statuses[-1]['status']

                elif activity.type in set([Activity.MERGE, Activity.NOTE]):
                    pass
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
        )

        processed_groups = [self.processSet(group, dates) for group in groups]

        stat_table = {int(to_timestamp(date)): {} for date in dates}

        for pg in processed_groups:
            for data_point in pg:

                status = data_point['status']
                ov = stat_table[data_point['timestamp']].get(status, 0)
                stat_table[data_point['timestamp']][status] = ov + 1

        return Response(stat_table)

        resolved = Group.objects.filter(status=GroupStatus.RESOLVED)
        ignored = Group.objects.filter(status=GroupStatus.IGNORED)
        unresolved = Group.objects.filter(status=GroupStatus.UNRESOLVED)

        assigned = [
            group for group in unresolved if group.assignee_set.count() > 0]

        data = {
            'resolved': len(resolved),
            'ignored': len(ignored),
            'unresolved': len(unresolved) - len(assigned),
            'assigned': len(assigned)
        }
        return Response(data)
