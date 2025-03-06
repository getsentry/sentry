from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models.grouphash import GroupHash
from sentry.models.grouptombstone import GroupTombstone
from sentry.models.project import Project


@region_silo_endpoint
class GroupTombstoneDetailsEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
    }

    def delete(self, request: Request, project: Project, tombstone_id: str) -> Response:
        """
        Remove a GroupTombstone
        ```````````````````````

        Undiscards a group such that new events in that group will be captured.
        This does not restore any previous data.

        :pparam string organization_id_or_slug: the id or slug of the organization.
        :pparam string project_id_or_slug: the id or slug of the project to which this tombstone belongs.
        :pparam string tombstone_id: the ID of the tombstone to remove.
        :auth: required
        """

        try:
            tombstone = GroupTombstone.objects.get(project_id=project.id, id=tombstone_id)
        except GroupTombstone.DoesNotExist:
            raise ResourceDoesNotExist

        GroupHash.objects.filter(project_id=project.id, group_tombstone_id=tombstone_id).update(
            # will allow new events to be captured
            group_tombstone_id=None
        )

        tombstone.delete()

        return Response(status=204)
