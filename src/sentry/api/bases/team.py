from __future__ import absolute_import

from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.app import raven
from sentry.models import Team, TeamStatus
from sentry.models.apikey import ROOT_KEY

from .organization import OrganizationPermission


class TeamPermission(OrganizationPermission):
    scope_map = {
        'GET': ['team:read', 'team:write', 'team:delete'],
        'POST': ['team:write', 'team:delete'],
        'PUT': ['team:write', 'team:delete'],
        'DELETE': ['team:delete'],
    }

    def has_object_permission(self, request, view, team):
        result = super(TeamPermission, self).has_object_permission(
            request, view, team.organization)
        if not result:
            return result

        if not (request.user and request.user.is_authenticated()) and request.auth:
            if request.auth is ROOT_KEY:
                return True
            return request.auth.organization_id == team.organization.id

        allowed_scopes = set(self.scope_map.get(request.method, []))
        return any(
            request.access.has_team_scope(team, s)
            for s in allowed_scopes,
        )


class TeamEndpoint(Endpoint):
    permission_classes = (TeamPermission,)

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
