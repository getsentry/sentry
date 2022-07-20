import rest_framework
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import ReleaseAnalyticsMixin
from sentry.api.bases import ProjectEndpoint, ProjectReleasePermission
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import serialize
from sentry.models.releaseactivity import ReleaseActivity


class ProjectReleaseActivityEndpoint(ProjectEndpoint, ReleaseAnalyticsMixin):
    private = True
    permission_classes = (ProjectReleasePermission,)

    def get(self, request: Request, project, version) -> Response:
        if not features.has("organizations:active-release-monitor-alpha", project.organization):
            raise rest_framework.exceptions.NotFound

        queryset = ReleaseActivity.objects.filter(
            release__releaseproject__project_id=project.id, release__version=version
        )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-date_added",
            on_results=lambda x: serialize([act for act in x], request.user),
            paginator_cls=DateTimePaginator,
        )
