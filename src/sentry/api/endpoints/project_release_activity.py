from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import ReleaseAnalyticsMixin
from sentry.api.bases import ProjectEndpoint, ProjectReleasePermission
from sentry.api.serializers import serialize
from sentry.models.releaseactivity import ReleaseActivity


class ProjectReleaseActivityEndpoint(ProjectEndpoint, ReleaseAnalyticsMixin):
    private = True
    permission_classes = (ProjectReleasePermission,)

    def get(self, request: Request, project, version) -> Response:
        if not features.has("organizations:active-release-monitor-alpha", project.organization):
            return Response(status=404)

        activity = ReleaseActivity.objects.filter(
            release__releaseproject__project_id=project.id, release__version=version
        ).order_by("-date_added")

        return Response(
            serialize(
                list(activity),
                request.user,
            )
        )
