from __future__ import annotations

from sentry.api.bases.organization import OrganizationPermission


class OrganizationTraceExplorerAIPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read"],
        "POST": ["org:read"],
    }
