from __future__ import absolute_import

from sentry.auth import access
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
            if self.is_project_key(request):
                return False
            return request.auth.organization_id == team.organization_id

        request.access = access.from_user(request.user, team.organization)

        allowed_scopes = set(self.scope_map.get(request.method, []))
        return any(request.access.has_team_scope(team, s) for s in allowed_scopes)


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
