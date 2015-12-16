from __future__ import absolute_import

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize, ProjectUserReportSerializer
from sentry.api.paginator import DateTimePaginator
from sentry.models import UserReport


class ProjectUserReportsEndpoint(ProjectEndpoint):
    def get(self, request, project):
        queryset = UserReport.objects.filter(
            project=project,
            group__isnull=False,
        ).select_related('group')

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='-date_added',
            on_results=lambda x: serialize(x, request.user, ProjectUserReportSerializer()),
            paginator_cls=DateTimePaginator,
        )
