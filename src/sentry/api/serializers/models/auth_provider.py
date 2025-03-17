from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypedDict

from django.contrib.auth.models import AnonymousUser
from django.db.models import F

from sentry import features
from sentry.api.serializers import Serializer, register
from sentry.auth.services.auth import RpcAuthProvider
from sentry.models.authprovider import AuthProvider
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.organizations.absolute_url import organization_absolute_url
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class AuthProviderDict(TypedDict):
    id: str
    provider_name: str
    pending_links_count: int
    login_url: str
    default_role: str
    require_link: bool
    scim_enabled: bool


@register(AuthProvider)
class AuthProviderSerializer(Serializer):
    def serialize(
        self,
        obj: AuthProvider | RpcAuthProvider,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> AuthProviderDict:
        organization = kwargs.pop("organization")  # required arg
        pending_links_count = OrganizationMember.objects.filter(
            organization_id=organization.id,
            flags=F("flags").bitand(~OrganizationMember.flags["sso:linked"]),
        ).count()

        login_url = Organization.get_url(organization.slug)

        absolute_login_url = organization_absolute_url(
            has_customer_domain=features.has("system:multi-region"),
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
