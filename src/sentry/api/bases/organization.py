from __future__ import absolute_import

from sentry.auth import access
from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import ScopedPermission
from sentry.models import Organization, OrganizationStatus
from sentry.models.apikey import ROOT_KEY


class OrganizationPermission(ScopedPermission):
    scope_map = {
        'GET': ['org:read', 'org:write', 'org:delete'],
        'POST': ['org:write', 'org:delete'],
        'PUT': ['org:write', 'org:delete'],
        'DELETE': ['org:delete'],
    }

    def has_object_permission(self, request, view, organization):
        if request.auth:
            if request.auth is ROOT_KEY:
                return True
            return request.auth.organization_id == organization.id

        request.access = access.from_request(request, organization)
        allowed_scopes = set(self.scope_map.get(request.method, []))
        return any(request.access.has_scope(s) for s in allowed_scopes)


class OrganizationEndpoint(Endpoint):
    permission_classes = (OrganizationPermission,)

    def convert_args(self, request, organization_slug, *args, **kwargs):
        try:
            organization = Organization.objects.get_from_cache(
                slug=organization_slug,
            )
        except Organization.DoesNotExist:
            raise ResourceDoesNotExist

        if organization.status != OrganizationStatus.VISIBLE:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, organization)

        kwargs['organization'] = organization
        return (args, kwargs)
