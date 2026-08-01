from __future__ import annotations

from typing import Any

from rest_framework.request import Request
from rest_framework.views import APIView

from sentry.api.bases.organization import OrganizationPermission
from sentry.auth.superuser import is_active_superuser
from sentry.investigations.models import Investigation
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.roles import organization_roles


def is_organization_manager(request: Request, organization: Organization) -> bool:
    if is_active_superuser(request):
        return True
    role = (
        OrganizationMember.objects.filter(
            organization=organization,
            user_id=request.user.id,
            user_is_active=True,
        )
        .values_list("role", flat=True)
        .first()
    )
    if role is None:
        return False
    return organization_roles.get(role).priority >= organization_roles.get("manager").priority


class InvestigationPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:read", "org:write", "org:admin"],
        "PUT": ["org:read", "org:write", "org:admin"],
        "DELETE": ["org:read", "org:write", "org:admin"],
    }

    def has_object_permission(self, request: Request, view: APIView, obj: Any) -> bool:
        if isinstance(obj, Organization):
            return super().has_object_permission(request, view, obj)
        if not isinstance(obj, Investigation):
            return True
        if request.method == "GET":
            return True
        if getattr(view, "collaboration_endpoint", False):
            return True
        if getattr(view, "manager_or_creator_only", False):
            return is_organization_manager(request, obj.organization) or (
                request.user.id == obj.created_by_id
            )
        if is_organization_manager(request, obj.organization):
            return True
        if hasattr(obj, "permissions"):
            user_id = request.user.id
            return user_id is not None and obj.permissions.has_edit_permissions(user_id)
        return True
