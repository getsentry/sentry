from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from django.db import router, transaction
from django.db.models import Count, F

from sentry import audit_log
from sentry.auth.services.auth import (
    AuthService,
    RpcApiKey,
    RpcAuthProvider,
    RpcOrganizationAuthConfig,
)
from sentry.auth.services.auth.serial import serialize_api_key, serialize_auth_provider
from sentry.db.postgres.transactions import enforce_constraints
from sentry.hybridcloud.models.outbox import outbox_context
from sentry.models.apikey import ApiKey
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.authidentity import AuthIdentity
from sentry.models.authprovider import AuthProvider
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.organizations.services.organization.service import organization_service
from sentry.signals import sso_enabled
from sentry.silo.safety import unguarded_write
from sentry.users.models.user import User


class DatabaseBackedAuthService(AuthService):
    def get_organization_api_keys(self, *, organization_id: int) -> list[RpcApiKey]:
        return [
            serialize_api_key(k) for k in ApiKey.objects.filter(organization_id=organization_id)
        ]

    def get_organization_key(self, *, key: str) -> RpcApiKey | None:
        try:
            return serialize_api_key(ApiKey.objects.get(key=key))
        except ApiKey.DoesNotExist:
            return None

    def enable_partner_sso(
        self,
        *,
        organization_id: int,
        provider_key: str,
        provider_config: dict[str, Any],
        user_id: int | None = None,
        sender: str | None = None,
        equivalent_providers: list[str] | None = None,
    ) -> None:
        with enforce_constraints(transaction.atomic(router.db_for_write(AuthProvider))):
            possible_providers = [provider_key] + (equivalent_providers or [])
            auth_provider_query = AuthProvider.objects.filter(
                organization_id=organization_id,
                provider__in=possible_providers,
                config=provider_config,
            )
            if not auth_provider_query.exists():
                auth_provider = AuthProvider.objects.create(
                    organization_id=organization_id, provider=provider_key, config=provider_config
                )

                AuditLogEntry.objects.create(
                    organization_id=organization_id,
                    actor_label=f"partner_provisioning_api:{provider_key}",
                    target_object=auth_provider.id,
                    event=audit_log.get_event_id("SSO_ENABLE"),
                    data=auth_provider.get_audit_log_data(),
                )

                if user_id:
                    organization_service.schedule_signal(
                        sso_enabled,
                        organization_id=organization_id,
                        args=dict(
                            user_id=user_id,
                            provider=provider_key,
                        ),
                    )

    def create_auth_identity(
        self,
        *,
        provider: str,
        config: Mapping[str, Any],
        user_id: int,
        ident: str,
        equivalent_providers: list[str] | None = None,
    ) -> None:
        with enforce_constraints(transaction.atomic(router.db_for_write(AuthIdentity))):
            possible_providers = [provider] + (equivalent_providers or [])
            auth_provider = AuthProvider.objects.filter(
                provider__in=possible_providers, config=config
            ).first()
            if auth_provider is None:
                return
            # Add Auth identity for partner's SSO if it doesn't exist
            auth_id_filter = AuthIdentity.objects.filter(
                auth_provider=auth_provider, user_id=user_id
            )
            if not auth_id_filter.exists():
                AuthIdentity.objects.create(
                    auth_provider=auth_provider,
                    user_id=user_id,
                    ident=ident,
                    data={},
                )

    def get_auth_provider_with_config(
        self, *, provider: str, config: Mapping[str, Any]
    ) -> RpcAuthProvider | None:
        existing_provider = AuthProvider.objects.filter(provider=provider, config=config).first()
        if existing_provider is None:
            return None
        return serialize_auth_provider(existing_provider)

    def get_org_auth_config(
        self, *, organization_ids: list[int]
    ) -> list[RpcOrganizationAuthConfig]:
        aps = {
            ap.organization_id: ap
            for ap in AuthProvider.objects.filter(organization_id__in=organization_ids)
        }
        qs = {
            row["organization_id"]: row["id__count"]
            for row in (
                ApiKey.objects.filter(organization_id__in=organization_ids)
                .values("organization_id")
                .annotate(Count("id"))
            )
        }
        return [
            RpcOrganizationAuthConfig(
                organization_id=oid,
                auth_provider=serialize_auth_provider(aps[oid]) if oid in aps else None,
                has_api_key=qs.get(oid, 0) > 0,
            )
            for oid in organization_ids
        ]

    def get_org_ids_with_scim(
        self,
    ) -> list[int]:
        return list(
            AuthProvider.objects.filter(
                flags=F("flags").bitor(AuthProvider.flags.scim_enabled)
            ).values_list("organization_id", flat=True)
        )

    def get_auth_provider(self, organization_id: int) -> RpcAuthProvider | None:
        try:
            auth_provider = AuthProvider.objects.get(organization_id=organization_id)
        except AuthProvider.DoesNotExist:
            return None
        return serialize_auth_provider(auth_provider)

    def change_scim(
        self, *, user_id: int, provider_id: int, enabled: bool, allow_unlinked: bool
    ) -> None:
        try:
            auth_provider = AuthProvider.objects.get(id=provider_id)
            user = User.objects.get(id=user_id)
        except (AuthProvider.DoesNotExist, User.DoesNotExist):
            return

        with outbox_context(transaction.atomic(router.db_for_write(AuthProvider))):
            auth_provider.flags.allow_unlinked = allow_unlinked
            if auth_provider.flags.scim_enabled != enabled:
                if enabled:
                    auth_provider.enable_scim(user)
                else:
                    auth_provider.disable_scim()

            auth_provider.save()

    def disable_provider(self, *, provider_id: int) -> None:
        with outbox_context(transaction.atomic(router.db_for_write(AuthProvider))):
            try:
                auth_provider = AuthProvider.objects.get(id=provider_id)
            except AuthProvider.DoesNotExist:
                return

            user_ids = OrganizationMemberMapping.objects.filter(
                organization_id=auth_provider.organization_id
            ).values_list("user_id", flat=True)
            with unguarded_write(router.db_for_write(User)):
                User.objects.filter(id__in=user_ids).update(is_managed=False)

            if auth_provider.flags.scim_enabled:
                auth_provider.disable_scim()
            auth_provider.delete()

    def update_provider_config(
        self, organization_id: int, auth_provider_id: int, config: dict[str, Any]
    ) -> None:
        current_provider = AuthProvider.objects.filter(
            organization_id=organization_id, id=auth_provider_id
        ).first()
        if current_provider is None:
            return
        current_provider.config = config
        current_provider.save()

    def update_provider(self, organization_id: int, auth_provider_id: int, provider: str) -> None:
        current_provider = AuthProvider.objects.filter(
            organization_id=organization_id, id=auth_provider_id
        ).first()
        if current_provider is None:
            return
        current_provider.provider = provider
        current_provider.save()


class FakeRequestDict:
    d: Mapping[str, str | bytes | None]
    _accessed: set[str]

    def __init__(self, **d: Any):
        self.d = d
        self._accessed = set()

    @property
    def accessed(self) -> bool:
        return bool(self._accessed)

    def __getitem__(self, item: str) -> str | bytes:
        self._accessed.add(item)
        result = self.d[item]
        if result is None:
            raise KeyError(f"Key '{item!r}' does not exist")
        return result

    def __contains__(self, item: str) -> bool:
        return self.d.get(item, None) is not None

    def get(self, key: str, default: str | bytes | None = None) -> str | bytes | None:
        try:
            return self[key]
        except KeyError:
            return default


def promote_request_rpc_user(request: Any) -> User:
    if not hasattr(request, "_promoted_user"):
        setattr(request, "_promoted_user", User.objects.get(id=request.user.id))
    return request._promoted_user


promote_request_api_user = promote_request_rpc_user
