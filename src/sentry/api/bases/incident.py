from __future__ import absolute_import

from sentry.api.bases.organization import OrganizationPermission


class IncidentPermission(OrganizationPermission):
    scope_map = {
        'GET': ['org:read', 'org:write', 'org:admin'],
        'POST': ['org:write', 'org:admin'],
        'PUT': ['org:write', 'org:admin'],
    }
