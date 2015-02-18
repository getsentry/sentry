from __future__ import absolute_import

from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import ScopedPermission
from sentry.models import Team


class TeamPermission(ScopedPermission):
    scope_map = {
        'GET': ['team:read', 'team:write', 'team:delete'],
        'POST': ['team:write', 'team:delete'],
        'PUT': ['team:write', 'team:delete'],
        'DELETE': ['team:delete'],
    }

    def has_object_permission(self, request, view, team):
        if request.auth:
            return request.auth.organization_id == team.organization_id
        if request.user.is_superuser:
            return True
        return team.has_access(request.user, self.access_map[request.method])


class TeamEndpoint(Endpoint):
    permission_classes = (TeamPermission,)

    def convert_args(self, request, organization_slug, team_slug, *args, **kwargs):
        try:
            team = Team.objects.get(
                organization__slug=organization_slug,
                slug=team_slug,
            )
        except Team.DoesNotExist:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, team)

        kwargs['team'] = team
        return (args, kwargs)
