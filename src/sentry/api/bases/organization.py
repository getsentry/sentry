from __future__ import absolute_import

from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import ScopedPermission
from sentry.models import Organization, OrganizationMember


class OrganizationPermission(ScopedPermission):
    scope_map = {
        'GET': ['org:read', 'org:write', 'org:delete'],
        'POST': ['org:write', 'org:delete'],
        'PUT': ['org:write', 'org:delete'],
        'DELETE': ['org:delete'],
    }

    def has_object_permission(self, request, view, organization):
        if request.auth:
            if self.is_project_key(request):
                return False
            return request.auth.organization_id == organization.id
        if request.user.is_superuser:
            return True

        try:
            om = OrganizationMember.objects.get(
                organization=organization,
                user=request.user,
            )
        except OrganizationMember.DoesNotExist:
            return False

        allowed_scopes = set(self.scope_map[request.method])
        current_scopes = om.scopes
        return any(s in allowed_scopes for s in current_scopes)


class OrganizationEndpoint(Endpoint):
    permission_classes = (OrganizationPermission,)

    def convert_args(self, request, organization_slug, *args, **kwargs):
        try:
            organization = Organization.objects.get_from_cache(
                slug=organization_slug,
            )
        except Organization.DoesNotExist:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, organization)

        kwargs['organization'] = organization
        return (args, kwargs)
