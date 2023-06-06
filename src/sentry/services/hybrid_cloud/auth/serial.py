from __future__ import annotations

from typing import cast

from sentry.models import AuthProvider
from sentry.services.hybrid_cloud.auth import RpcAuthProvider, RpcAuthProviderFlags


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
