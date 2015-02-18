from __future__ import absolute_import

from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import ScopedPermission
from sentry.models import Group


class GroupPermission(ScopedPermission):
    scope_map = {
        'GET': ['event:read', 'event:write', 'event:delete'],
        'POST': ['event:write', 'event:delete'],
        'PUT': ['event:write', 'event:delete'],
        'DELETE': ['event:delete'],
    }

    def has_object_permission(self, request, view, group):
        if request.auth:
            return request.auth.organization_id == group.project.organization_id
        if request.user.is_superuser:
            return True
        return group.project.has_access(request.user, self.access_map[request.method])


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
