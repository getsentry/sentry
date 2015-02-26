from __future__ import absolute_import

from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.bases.project import ProjectPermission
from sentry.models import Group


class GroupPermission(ProjectPermission):
    scope_map = {
        'GET': ['event:read', 'event:write', 'event:delete'],
        'POST': ['event:write', 'event:delete'],
        'PUT': ['event:write', 'event:delete'],
        'DELETE': ['event:delete'],
    }

    def has_object_permission(self, request, view, group):
        return super(GroupPermission, self).has_object_permission(
            request, view, group.project)


class GroupEndpoint(Endpoint):
    permission_classes = (GroupPermission,)

    def convert_args(self, request, group_id, *args, **kwargs):
        try:
            group = Group.objects.get_from_cache(
                id=group_id,
            )
        except Group.DoesNotExist:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, group)

        kwargs['group'] = group
        return (args, kwargs)
