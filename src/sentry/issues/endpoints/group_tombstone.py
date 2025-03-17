from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models.grouptombstone import GroupTombstone
from sentry.models.project import Project


@region_silo_endpoint
class GroupTombstoneEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, project: Project) -> Response:
        """
        Retrieve a Project's GroupTombstones
        ````````````````````````````````````

        Lists a project's `GroupTombstone` objects

        :pparam string organization_id: the ID of the organization.
        :pparam string project_id: the ID of the project to get the tombstones for
        :auth: required
        """
        queryset = GroupTombstone.objects.filter(project=project)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="id",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )
