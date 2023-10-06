from __future__ import annotations

import secrets
from datetime import timedelta
from typing import Optional, Tuple

from django.db import models, router, transaction
from django.utils import timezone
from django.utils.encoding import force_str

from sentry.backup.dependencies import ImportKind
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope, RelocationScope
from sentry.constants import SentryAppStatus
from sentry.db.models import (
    BaseManager,
    FlexibleForeignKey,
    Model,
    control_silo_only_model,
    sane_repr,
)
from sentry.models.apiscopes import HasApiScopes

DEFAULT_EXPIRATION = timedelta(days=30)


def default_expiration():
    return timezone.now() + DEFAULT_EXPIRATION


def generate_token():
    return secrets.token_hex(nbytes=32)


@control_silo_only_model
class ApiToken(Model, HasApiScopes):
    __relocation_scope__ = {RelocationScope.Global, RelocationScope.Config}

    # users can generate tokens without being application-bound
    application = FlexibleForeignKey("sentry.ApiApplication", null=True)
    user = FlexibleForeignKey("sentry.User")
    token = models.CharField(max_length=64, unique=True, default=generate_token)
    refresh_token = models.CharField(max_length=64, unique=True, null=True, default=generate_token)
    expires_at = models.DateTimeField(null=True, default=default_expiration)
    date_added = models.DateTimeField(default=timezone.now)

    objects = BaseManager(cache_fields=("token",))

    class Meta:
        app_label = "sentry"
        db_table = "sentry_apitoken"

    __repr__ = sane_repr("user_id", "token", "application_id")

    def __str__(self):
        return force_str(self.token)

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
        query = models.Q(token=self.token) | models.Q(refresh_token=self.refresh_token)
        existing = self.__class__.objects.filter(query).first()
        if existing:
            self.expires_at = timezone.now() + DEFAULT_EXPIRATION
            self.token = generate_token()
            self.refresh_token = generate_token()

        return super().write_relocation_import(scope, flags)

    @property
    def organization_id(self) -> int | None:
        from sentry.models import SentryAppInstallation, SentryAppInstallationToken

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
    from sentry.services.hybrid_cloud.auth import AuthenticatedToken

    if isinstance(auth, AuthenticatedToken):
        return auth.kind == "api_token"
    return isinstance(auth, ApiToken)
