from __future__ import annotations

import secrets
from datetime import timedelta
from typing import ClassVar, Collection, Optional, Tuple

from django.db import models, router, transaction
from django.utils import timezone
from django.utils.encoding import force_str

from sentry.backup.dependencies import ImportKind
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope, RelocationScope
from sentry.constants import SentryAppStatus
from sentry.db.models import FlexibleForeignKey, control_silo_only_model, sane_repr
from sentry.db.models.outboxes import ControlOutboxProducingManager, ReplicatedControlModel
from sentry.models.apiscopes import HasApiScopes
from sentry.models.outbox import OutboxCategory
from sentry.types.region import find_all_region_names

DEFAULT_EXPIRATION = timedelta(days=30)


def default_expiration():
    return timezone.now() + DEFAULT_EXPIRATION


def generate_token():
    return secrets.token_hex(nbytes=32)


@control_silo_only_model
class ApiToken(ReplicatedControlModel, HasApiScopes):
    __relocation_scope__ = {RelocationScope.Global, RelocationScope.Config}
    category = OutboxCategory.API_TOKEN_UPDATE

    # users can generate tokens without being application-bound
    application = FlexibleForeignKey("sentry.ApiApplication", null=True)
    user = FlexibleForeignKey("sentry.User")
    name = models.CharField(max_length=255, null=True)
    token = models.CharField(max_length=64, unique=True, default=generate_token)
    token_last_characters = models.CharField(max_length=4, null=True)
    refresh_token = models.CharField(max_length=64, unique=True, null=True, default=generate_token)
    expires_at = models.DateTimeField(null=True, default=default_expiration)
    date_added = models.DateTimeField(default=timezone.now)

    objects: ClassVar[ControlOutboxProducingManager[ApiToken]] = ControlOutboxProducingManager(
        cache_fields=("token",)
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_apitoken"

    __repr__ = sane_repr("user_id", "token", "application_id")

    def __str__(self):
        return force_str(self.token)

    # TODO(mdtro): uncomment this function after 0583_apitoken_add_name_and_last_chars migration has been applied
    # def save(self, *args: Any, **kwargs: Any) -> None:
    #     # when a new ApiToken is created we take the last four characters of the token
    #     # and save them in the `token_last_characters` field so users can identify
    #     # tokens in the UI where they're mostly obfuscated
    #     token_last_characters = self.token[-4:]
    #     self.token_last_characters = token_last_characters

    #     return super().save(**kwargs)

    def outbox_region_names(self) -> Collection[str]:
        return list(find_all_region_names())

    def handle_async_replication(self, region_name: str, shard_identifier: int) -> None:
        from sentry.services.hybrid_cloud.auth.serial import serialize_api_token
        from sentry.services.hybrid_cloud.replica import region_replica_service

        region_replica_service.upsert_replicated_api_token(
            api_token=serialize_api_token(self),
            region_name=region_name,
        )

    @classmethod
    def from_grant(cls, grant):
        with transaction.atomic(router.db_for_write(cls)):
            return cls.objects.create(
                application=grant.application, user=grant.user, scope_list=grant.get_scopes()
            )

    def is_expired(self):
        if not self.expires_at:
            return False

        return timezone.now() >= self.expires_at

    def get_audit_log_data(self):
        return {"scopes": self.get_scopes()}

    def get_allowed_origins(self):
        if self.application:
            return self.application.get_allowed_origins()
        return ()

    def refresh(self, expires_at=None):
        if expires_at is None:
            expires_at = timezone.now() + DEFAULT_EXPIRATION

        self.update(token=generate_token(), refresh_token=generate_token(), expires_at=expires_at)

    def get_relocation_scope(self) -> RelocationScope:
        if self.application_id is not None:
            # TODO(getsentry/team-ospo#188): this should be extension scope once that gets added.
            return RelocationScope.Global

        return RelocationScope.Config

    def write_relocation_import(
        self, scope: ImportScope, flags: ImportFlags
    ) -> Optional[Tuple[int, ImportKind]]:
        # If there is a token collision, generate new tokens.
        query = models.Q(token=self.token) | models.Q(
            refresh_token__isnull=False, refresh_token=self.refresh_token
        )
        existing = self.__class__.objects.filter(query).first()
        if existing:
            self.token = generate_token()
            if self.refresh_token is not None:
                self.refresh_token = generate_token()
            if self.expires_at is not None:
                self.expires_at = timezone.now() + DEFAULT_EXPIRATION

        return super().write_relocation_import(scope, flags)

    @property
    def organization_id(self) -> int | None:
        from sentry.models.integrations.sentry_app_installation import SentryAppInstallation
        from sentry.models.integrations.sentry_app_installation_token import (
            SentryAppInstallationToken,
        )

        try:
            installation = SentryAppInstallation.objects.get_by_api_token(self.id).get()
        except SentryAppInstallation.DoesNotExist:
            installation = None

        # TODO(nisanthan): Right now, Internal Integrations can have multiple ApiToken, so we use the join table `SentryAppInstallationToken` to map the one to many relationship. However, for Public Integrations, we can only have 1 ApiToken per installation. So we currently don't use the join table for Public Integrations. We should update to make records in the join table for Public Integrations so that we can have a common abstraction for finding an installation by ApiToken.
        if not installation or installation.sentry_app.status == SentryAppStatus.INTERNAL:
            try:
                install_token = SentryAppInstallationToken.objects.select_related(
                    "sentry_app_installation"
                ).get(api_token_id=self.id)
            except SentryAppInstallationToken.DoesNotExist:
                return None
            return install_token.sentry_app_installation.organization_id

        return installation.organization_id


def is_api_token_auth(auth: object) -> bool:
    """:returns True when an API token is hitting the API."""
    from sentry.hybridcloud.models.apitokenreplica import ApiTokenReplica
    from sentry.services.hybrid_cloud.auth import AuthenticatedToken

    if isinstance(auth, AuthenticatedToken):
        return auth.kind == "api_token"
    return isinstance(auth, ApiToken) or isinstance(auth, ApiTokenReplica)
