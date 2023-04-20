from __future__ import annotations

from typing import TYPE_CHECKING

from django.db.models import F

from sentry import features
from sentry.api.serializers import Serializer, register
from sentry.models import AuthProvider, Organization, OrganizationMember, organization_absolute_url
from sentry.services.hybrid_cloud.organization import RpcOrganization, organization_service

if TYPE_CHECKING:
    from sentry.services.hybrid_cloud.auth import RpcAuthProvider


@register(AuthProvider)
class AuthProviderSerializer(Serializer):
    def serialize(
        self,
        obj: AuthProvider | RpcAuthProvider,
        attrs,
        user,
        organization: Organization | RpcOrganization | None = None,
    ):
        if not organization:
            org_context = organization_service.get_organization_by_id(id=obj.organization_id)
            if org_context:
                organization = org_context.organization
        assert organization, "Could not find organization for serialization"

        pending_links_count = OrganizationMember.objects.filter(
            organization_id=organization.id,
            flags=F("flags").bitand(~OrganizationMember.flags["sso:linked"]),
        ).count()

        login_url = Organization.get_url(organization.slug)

        absolute_login_url = organization_absolute_url(
            features.has("organizations:customer-domains", organization),
            slug=organization.slug,
            path=login_url,
        )

        return {
            "id": str(obj.id),
            "provider_name": obj.provider,
            "pending_links_count": pending_links_count,
            "login_url": absolute_login_url,
            "default_role": organization.default_role,
            "require_link": not obj.flags.allow_unlinked,
            "scim_enabled": bool(obj.flags.scim_enabled),
        }
