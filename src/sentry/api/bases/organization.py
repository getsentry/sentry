from __future__ import absolute_import

from rest_framework.exceptions import NotAuthenticated

from sentry.api.base import Endpoint, logger
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import ScopedPermission
from sentry.app import raven
from sentry.auth import access
from sentry.models import Organization, OrganizationStatus
from sentry.models.apikey import ROOT_KEY
from sentry.utils import auth


class OrganizationPermission(ScopedPermission):
    scope_map = {
        'GET': ['org:read', 'org:write', 'org:delete'],
        'POST': ['org:write', 'org:delete'],
        'PUT': ['org:write', 'org:delete'],
        'DELETE': ['org:delete'],
    }

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
        if request.user and request.user.is_authenticated() and request.auth:
            request.access = access.from_request(
                request, organization, scopes=request.auth.get_scopes(),
            )

        elif request.auth:
            if request.auth is ROOT_KEY:
                return True
            return request.auth.organization_id == organization.id

        else:
            request.access = access.from_request(request, organization)
            # session auth needs to confirm various permissions
            if request.user.is_authenticated() and self.needs_sso(request, organization):
                logger.info('access.must-sso', extra={
                    'organization_id': organization.id,
                    'user_id': request.user.id,
                })
                raise NotAuthenticated(detail='Must login via SSO')

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

        raven.tags_context({
            'organization': organization.id,
        })

        kwargs['organization'] = organization
        return (args, kwargs)
