from __future__ import annotations

from django.db.models import F

from sentry import features
from sentry.api.serializers import Serializer, register
from sentry.models.authprovider import AuthProvider
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.services.hybrid_cloud.auth import RpcAuthProvider
from sentry.services.hybrid_cloud.organization.model import RpcOrganization
from sentry.types.organization import OrganizationAbsoluteUrlMixin


@register(AuthProvider)
class AuthProviderSerializer(Serializer):
    def serialize(
        self,
        obj: AuthProvider | RpcAuthProvider,
        attrs,
        user,
        organization: Organization | RpcOrganization,
    ):
        pending_links_count = OrganizationMember.objects.filter(
            organization_id=organization.id,
            flags=F("flags").bitand(~OrganizationMember.flags["sso:linked"]),
        ).count()

        login_url = Organization.get_url(organization.slug)

        absolute_login_url = OrganizationAbsoluteUrlMixin.organization_absolute_url(
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
