from __future__ import annotations

from typing import cast

from rest_framework.request import Request

from sentry.models import AuthProvider
from sentry.services.hybrid_cloud.auth import RpcAuthInvite, RpcAuthProvider, RpcAuthProviderFlags


def _serialize_auth_provider_flags(ap: AuthProvider) -> RpcAuthProviderFlags:
    return cast(
        RpcAuthProviderFlags,
        RpcAuthProviderFlags.serialize_by_field_name(ap.flags, value_transform=bool),
    )


def serialize_auth_provider(ap: AuthProvider) -> RpcAuthProvider:
    return RpcAuthProvider(
        id=ap.id,
        organization_id=ap.organization_id,
        provider=ap.provider,
        flags=_serialize_auth_provider_flags(ap),
    )


def serialize_invite_from_request(request: Request) -> RpcAuthInvite:
    return RpcAuthInvite(
        invite_token=request.session.get("invite_token", None),
        invite_member_id=request.session.get("invite_member_id", None),
        user_id=request.user.id,
        user_is_authenticated=request.user.is_authenticated,
        user_has_2fa=request.user.has_2fa(),
    )
