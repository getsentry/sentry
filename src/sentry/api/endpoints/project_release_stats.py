from __future__ import absolute_import

import datetime
import six
from collections import namedtuple

from django.db.models import Avg, Count
from django.utils import timezone

from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.app import tsdb
from sentry.models import Release

StatsPeriod = namedtuple('StatsPeriod', ('segments', 'interval'))


class ProjectReleaseStatsEndpoint(ProjectEndpoint):
    permission_classes = (ProjectReleasePermission,)

    STATS_PERIODS = {
        '24h': StatsPeriod(24, datetime.timedelta(hours=1)),
        '30d': StatsPeriod(30, datetime.timedelta(hours=24)),
    }

    def get(self, request, project):
        # avg num events per release
        # TODO(jess)

        # avg num authors per release
        avg_num_authors = Release.objects.filter(
            projects=project,
            organization_id=project.organization_id,
        ).annotate(
            num_authors=Count('releasecommit__commit__author'),
        ).aggregate(Avg('num_authors'))['num_authors__avg']

        # time to release (avg time between releases)
        sum_deltas = datetime.timedelta(seconds=0)
        release_dates = list(Release.objects.filter(
            projects=project,
            organization_id=project.organization_id,
        ).order_by('date_added').values_list('date_added', flat=True))

        for i, date_added in enumerate(release_dates):
            try:
                next_date = release_dates[i + 1]
            except IndexError:
                pass
            else:
                sum_deltas += (next_date - date_added)

        release_ids = list(Release.objects.filter(
            projects=project,
            organization_id=project.organization_id,
        ).values_list('id', flat=True))

        items = {
            project.id: release_ids,
        }

        until = timezone.now()
        stats = {}
        for key, (segments, interval) in six.iteritems(self.STATS_PERIODS):
            since = until - (segments * interval)

            _stats = tsdb.get_frequency_series(
                model=tsdb.models.frequent_releases_by_project,
                items=items,
                start=since,
                end=until,
                rollup=int(interval.total_seconds()),
            )
            stats[key] = _stats.get(project.id, [])

        return Response({
            'AvgNumAuthors': avg_num_authors,
            'AvgTimeToRelease': (sum_deltas / len(release_dates)).total_seconds() * 1000,
            'CountReleases': len(release_dates),
            'stats': stats,
        })
