from __future__ import annotations

from typing import TYPE_CHECKING

from django.db.models import F

from sentry.api.serializers import Serializer, register
from sentry.models import AuthProvider, Organization, OrganizationMember

if TYPE_CHECKING:
    from sentry.services.hybrid_cloud.auth import RpcAuthProvider


@register(AuthProvider)
class AuthProviderSerializer(Serializer):
    def serialize(
        self,
        obj: AuthProvider | RpcAuthProvider,
        attrs,
        user,
        organization: Organization | None = None,
    ):
        organization = organization or obj.organization
        pending_links_count = OrganizationMember.objects.filter(
            organization=organization,
            flags=F("flags").bitand(~OrganizationMember.flags["sso:linked"]),
        ).count()

        login_url = Organization.get_url(organization.slug)

        return {
            "id": str(obj.id),
            "provider_name": obj.provider,
            "pending_links_count": pending_links_count,
            "login_url": organization.absolute_url(login_url),
            "default_role": organization.default_role,
            "require_link": not obj.flags.allow_unlinked,
            "scim_enabled": bool(obj.flags.scim_enabled),
        }
