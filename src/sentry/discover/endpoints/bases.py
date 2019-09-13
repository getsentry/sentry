from __future__ import absolute_import

from sentry.api.bases.organization import OrganizationPermission


class DiscoverSavedQueryPermission(OrganizationPermission):
    # Relaxed permissions for saved queries in Discover
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:read", "org:write", "org:admin"],
        "PUT": ["org:read", "org:write", "org:admin"],
        "DELETE": ["org:read", "org:write", "org:admin"],
    }
