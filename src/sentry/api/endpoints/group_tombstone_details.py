from rest_framework.response import Response

from sentry.api.bases import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import GroupHash, GroupTombstone


class GroupTombstoneDetailsEndpoint(ProjectEndpoint):
    def delete(self, request, project, tombstone_id):
        """
        Remove a GroupTombstone
        ```````````````````````

        Undiscards a group such that new events in that group will be captured.
        This does not restore any previous data.

        :pparam string organization_slug: the slug of the organization.
        :pparam string project_slug: the slug of the project to which this tombstone belongs.
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
