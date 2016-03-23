from __future__ import absolute_import

import logging

from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.bases.project import ProjectPermission
from sentry.models import Group, GroupRedirect


logger = logging.getLogger(__name__)


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


def get_group(issue_id):
    """
    Retrieve a group by ID, also checking if the ID was previously used by a
    group that was since merged.
    """
    queryset = Group.objects.select_related('project')
    try:
        group = queryset.get(id=issue_id)
    except Group.DoesNotExist:
        try:
            redirect = GroupRedirect.objects.get(previous_group_id=issue_id)
        except GroupRedirect.DoesNotExist:
            raise ResourceDoesNotExist

        # TODO(tkaemming): Ideally, this would return a 302 response,
        # rather than just returning the data that is bound to the new
        # group. (It technically shouldn't be a 301, since the response
        # could change again as the result of another merge operation that
        # occurs later. This wouldn't break anything though -- it will just
        # be a "permanent" redirect to *another* permanent redirect.) This
        # would require rebuilding the URL in one of two ways: either by
        # hacking it in with string replacement, or making the endpoint
        # aware of the URL pattern that caused it to be dispatched, and
        # reversing it with the correct `issue_id` keyword argument.
        try:
            group = queryset.get(id=redirect.group_id)
        except Group.DoesNotExist:
            logger.warning('%r redirected to group that does not exist!', redirect, exc_info=True)
            raise ResourceDoesNotExist

    return group


class GroupEndpoint(Endpoint):
    permission_classes = (GroupPermission,)

    def convert_args(self, request, issue_id, *args, **kwargs):
        group = get_group(issue_id)
        self.check_object_permissions(request, group)
        kwargs['group'] = group
        return (args, kwargs)
