from __future__ import absolute_import

import datetime

from django.db.models import Avg, Count

from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.models import Release


class ProjectReleaseStatsEndpoint(ProjectEndpoint):
    permission_classes = (ProjectReleasePermission,)

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

        return Response({
            'AvgNumAuthors': avg_num_authors,
            'AvgTimeToRelease': (sum_deltas / len(release_dates)).total_seconds() * 1000,
            'CountReleases': len(release_dates),
        })
