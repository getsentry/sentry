from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models.commit import Commit
from sentry.models.project import Project


@cell_silo_endpoint
class ProjectCommitsEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    permission_classes = (ProjectReleasePermission,)

    def get(self, request: Request, project: Project) -> Response:
        """
        List a Project's Commits
        `````````````````````````

        Retrieve a list of commits for a given project.

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          commit belongs to.
        :pparam string project_id_or_slug: the id or slug of the project to list the
                                     commits of.
        :qparam string query: this parameter can be used to create a
                              "starts with" filter for the commit key.
        """
        query = request.GET.get("query")

        queryset = Commit.objects.filter(
            organization_id=project.organization_id,
            releasecommit__release__releaseproject__project_id=project.id,
        )

        # A commit in several of the project's releases joins once per release.
        # DISTINCT ON over the sort keys drops the repeats and keeps Postgres
        # on the (organization_id, date_added) index walk; an id__in subquery
        # hashes every ReleaseCommit row of the project first, which is slow
        # for projects with long release history.
        if query:
            queryset = queryset.filter(key__istartswith=query).distinct("key", "date_added", "id")
            order_by: tuple[str, ...] = ("key", "-date_added", "-id")
        else:
            queryset = queryset.distinct("date_added", "id")
            order_by = ("-date_added", "-id")

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=order_by,
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )
