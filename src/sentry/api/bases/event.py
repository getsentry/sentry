from __future__ import absolute_import

from sentry.api.bases.project import ProjectPermission


class EventPermission(ProjectPermission):
    scope_map = {
        "GET": ["event:read", "event:write", "event:admin"],
        "POST": ["event:write", "event:admin"],
        "PUT": ["event:write", "event:admin"],
        "DELETE": ["event:admin"],
    }

    def has_object_permission(self, request, view, event):
        return super(EventPermission, self).has_object_permission(request, view, event.project)
