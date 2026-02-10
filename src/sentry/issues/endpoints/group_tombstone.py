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
        :qparam int issue_group_id: optional group ID to filter tombstones by their previous group ID
        :auth: required
        """
        queryset = GroupTombstone.objects.filter(project=project)

        # Filter by issue_group_id if provided
        issue_group_id = request.GET.get("issue_group_id")
        if issue_group_id:
            try:
                queryset = queryset.filter(previous_group_id=int(issue_group_id))
            except (ValueError, TypeError):
                return Response({"detail": "Invalid issue_group_id parameter"}, status=400)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="id",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )
