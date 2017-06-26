from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases import Endpoint
from sentry.api.bases.group import GroupPermission

from sentry.models import (
    GroupHash, GroupTombstone,
)


class GroupTombstoneDetailsEndpoint(Endpoint):
    permission_classes = (GroupPermission,)

    def delete(self, request, tombstone_id):
        """
        Remove a GroupTombstone
        ```````````````

        Undiscards a group such that new events in that group will be captured.
        This does not restore any previous data.

        :pparam string issue_id: the ID of the issue to delete.
        :auth: required
        """
        GroupHash.objects.filter(
            group_tombstone=tombstone_id,
        ).update(
            # will allow new events to be captured
            group_tombstone=None,
        )

        try:
            GroupTombstone.objects.get(id=tombstone_id).delete()
        except GroupTombstone.DoesNotExist:
            pass

        return Response(status=202)
