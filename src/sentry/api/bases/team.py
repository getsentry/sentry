from __future__ import absolute_import

from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.app import raven
from sentry.models import Team, TeamStatus

from .organization import OrganizationPermission


def has_team_permission(request, team, scope_map):
    if not (request.user and request.user.is_authenticated()) and request.auth:
        return request.auth.organization_id == team.organization.id

    allowed_scopes = set(scope_map.get(request.method, []))
    return any(request.access.has_team_scope(team, s) for s in allowed_scopes)


class TeamPermission(OrganizationPermission):
    scope_map = {
        'GET': ['team:read', 'team:write', 'team:admin'],
        'POST': ['team:write', 'team:admin'],
        'PUT': ['team:write', 'team:admin'],
        'DELETE': ['team:admin'],
    }

    def has_object_permission(self, request, view, team):
        result = super(TeamPermission,
                       self).has_object_permission(request, view, team.organization)
        if not result:
            return result

        return has_team_permission(request, team, self.scope_map)


class TeamEndpoint(Endpoint):
    permission_classes = (TeamPermission, )

    def convert_args(self, request, organization_slug, team_slug, *args, **kwargs):
        try:
            team = Team.objects.filter(
                organization__slug=organization_slug,
                slug=team_slug,
            ).select_related('organization').get()
        except Team.DoesNotExist:
            raise ResourceDoesNotExist

        if team.status != TeamStatus.VISIBLE:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, team)

        raven.tags_context({
            'organization': team.organization_id,
        })

        kwargs['team'] = team
        return (args, kwargs)
