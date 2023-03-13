from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import Commit


@region_silo_endpoint
class ProjectCommitsEndpoint(ProjectEndpoint):

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
        :qparam string query: this parameter can be used to create a
                              "starts with" filter for the commit key.
        """
        query = request.GET.get("query")

        queryset = Commit.objects.filter(
            organization_id=project.organization_id,
            releasecommit__release__releaseproject__project_id=project.id,
        )

        if query:
            queryset = queryset.filter(key__istartswith=query)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=("key", "-date_added") if query else "-date_added",
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )
