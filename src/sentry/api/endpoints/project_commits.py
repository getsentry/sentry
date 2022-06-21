from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import Commit


class ProjectCommitsEndpoint(ProjectEndpoint):
    private = True
    permission_classes = (ProjectReleasePermission,)

    def get(self, request: Request, project) -> Response:
        """
        List a Project's Commits
        `````````````````````````

        Retrieve a list of commits for a given project.

        :pparam string organization_slug: the slug of the organization the
                                          commit belongs to.
        :pparam string project_slug: the slug of the project to list the
                                     commits of.
        """

        queryset = Commit.objects.filter(
            organization_id=project.organization_id,
            releasecommit__release__releaseproject__project_id=project.id,
        ).distinct("id")

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=("-id", "-date_added"),
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )
