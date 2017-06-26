from __future__ import absolute_import

from sentry.api.bases import Endpoint
from sentry.api.bases.group import GroupPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize

from sentry.models import (
    GroupHash, GroupTombstone
)


class GroupTombstoneEndpoint(Endpoint):
    permission_classes = (GroupPermission,)

    def get(self, request, organization_id, project_id):
        """
        Retrieve a Project's GroupTombstones
        ```````````````

        Lists a project's `GroupTombstone` objects

        :pparam string organization_id: the ID of the organization.
        :pparam string project_id: the ID of the project to get the tombstones for
        :auth: required
        """
        queryset = GroupTombstone.objects.filter(
            id__in=GroupHash.objects.filter(
                project=project_id
            ).values_list('group_tombstone', flat=True)
        )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='id',
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )
