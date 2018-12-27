from __future__ import absolute_import

from sentry.utils.sdk import configure_scope
from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import SentryPermission
from sentry.auth.superuser import is_active_superuser
from sentry.models import (
    ApiKey, Authenticator, Organization, OrganizationMemberTeam, Project,
    ProjectTeam, ReleaseProject, Team
)
from sentry.utils import auth


class OrganizationPermission(SentryPermission):
    scope_map = {
        'GET': ['org:read', 'org:write', 'org:admin'],
        'POST': ['org:write', 'org:admin'],
        'PUT': ['org:write', 'org:admin'],
        'DELETE': ['org:admin'],
    }

    def is_not_2fa_compliant(self, user, organization):
        return organization.flags.require_2fa and not Authenticator.objects.user_has_2fa(user)

    def needs_sso(self, request, organization):
        # XXX(dcramer): this is very similar to the server-rendered views
        # logic for checking valid SSO
        if not request.access.requires_sso:
            return False
        if not auth.has_completed_sso(request, organization.id):
            return True
        if not request.access.sso_is_valid:
            return True
        return False

    def has_object_permission(self, request, view, organization):
        self.determine_access(request, organization)
        allowed_scopes = set(self.scope_map.get(request.method, []))
        return any(request.access.has_scope(s) for s in allowed_scopes)


# These are based on ProjectReleasePermission
# additional checks to limit actions to releases
# associated with projects people have access to
class OrganizationReleasePermission(OrganizationPermission):
    scope_map = {
        'GET': ['project:read', 'project:write', 'project:admin', 'project:releases'],
        'POST': ['project:write', 'project:admin', 'project:releases'],
        'PUT': ['project:write', 'project:admin', 'project:releases'],
        'DELETE': ['project:admin', 'project:releases'],
    }


class OrganizationIntegrationsPermission(OrganizationPermission):
    scope_map = {
        'GET': ['org:read', 'org:write', 'org:admin', 'org:integrations'],
        'POST': ['org:write', 'org:admin', 'org:integrations'],
        'PUT': ['org:write', 'org:admin', 'org:integrations'],
        'DELETE': ['org:admin', 'org:integrations'],
    }


class OrganizationAdminPermission(OrganizationPermission):
    scope_map = {
        'GET': ['org:admin'],
        'POST': ['org:admin'],
        'PUT': ['org:admin'],
        'DELETE': ['org:admin'],
    }


class OrganizationAuthProviderPermission(OrganizationPermission):
    scope_map = {
        'GET': ['org:read'],
        'POST': ['org:admin'],
        'PUT': ['org:admin'],
        'DELETE': ['org:admin'],
    }


class OrganizationDiscoverSavedQueryPermission(OrganizationPermission):
    # Relaxed permissions for saved queries in Discover
    scope_map = {
        'GET': ['org:read', 'org:write', 'org:admin'],
        'POST': ['org:read', 'org:write', 'org:admin'],
        'PUT': ['org:read', 'org:write', 'org:admin'],
        'DELETE': ['org:read', 'org:write', 'org:admin'],
    }


class OrganizationEndpoint(Endpoint):
    permission_classes = (OrganizationPermission, )

    def convert_args(self, request, organization_slug, *args, **kwargs):
        try:
            organization = Organization.objects.get_from_cache(
                slug=organization_slug,
            )
        except Organization.DoesNotExist:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, organization)

        with configure_scope() as scope:
            scope.set_tag("organization", organization.id)

        request._request.organization = organization

        # Track the 'active' organization when the request came from
        # a cookie based agent (react app)
        if request.auth is None and request.user:
            request.session['activeorg'] = organization.slug

        kwargs['organization'] = organization
        return (args, kwargs)


class OrganizationReleasesBaseEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationReleasePermission, )

    def get_allowed_projects(self, request, organization):
        has_valid_api_key = False
        if isinstance(request.auth, ApiKey):
            if request.auth.organization_id != organization.id:
                return []
            has_valid_api_key = request.auth.has_scope('project:releases') or \
                request.auth.has_scope('project:write')

        if not (has_valid_api_key or request.user.is_authenticated()):
            return []

        if has_valid_api_key or is_active_superuser(request) or organization.flags.allow_joinleave:
            allowed_teams = Team.objects.filter(organization=organization).values_list(
                'id', flat=True
            )
        else:
            allowed_teams = OrganizationMemberTeam.objects.filter(
                organizationmember__user=request.user,
                team__organization_id=organization.id,
            ).values_list(
                'team_id', flat=True
            )

        return Project.objects.filter(
            id__in=ProjectTeam.objects.filter(
                team_id__in=allowed_teams,
            ).values_list('project_id', flat=True)
        )

    def has_release_permission(self, request, organization, release):
        return ReleaseProject.objects.filter(
            release=release,
            project__in=self.get_allowed_projects(request, organization),
        ).exists()
