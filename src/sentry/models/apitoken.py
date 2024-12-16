from __future__ import annotations

import hashlib
import secrets
from collections.abc import Collection
from datetime import timedelta
from typing import Any, ClassVar

from django.db import models, router, transaction
from django.utils import timezone
from django.utils.encoding import force_str

from sentry.backup.dependencies import ImportKind, NormalizedModelName, get_model_name
from sentry.backup.helpers import ImportFlags
from sentry.backup.sanitize import SanitizableField, Sanitizer
from sentry.backup.scopes import ImportScope, RelocationScope
from sentry.constants import SentryAppStatus
from sentry.db.models import FlexibleForeignKey, control_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.hybridcloud.outbox.base import ControlOutboxProducingManager, ReplicatedControlModel
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.models.apigrant import ApiGrant
from sentry.models.apiscopes import HasApiScopes
from sentry.types.region import find_all_region_names
from sentry.types.token import AuthTokenType

DEFAULT_EXPIRATION = timedelta(days=30)
TOKEN_REDACTED = "***REDACTED***"


def default_expiration():
    return timezone.now() + DEFAULT_EXPIRATION


def generate_token(
    token_type: AuthTokenType | str | None = AuthTokenType.__empty__,
) -> str:
    if token_type:
        return f"{token_type}{secrets.token_hex(nbytes=32)}"

    return secrets.token_hex(nbytes=32)


class PlaintextSecretAlreadyRead(Exception):
    """the secret you are trying to read is read-once and cannot be accessed directly again"""

    pass


class NotSupported(Exception):
    """the method you called is not supported by this token type"""

    pass


class ApiTokenManager(ControlOutboxProducingManager["ApiToken"]):
    def create(self, *args, **kwargs):
        token_type: AuthTokenType | None = kwargs.get("token_type", None)

        # Typically the .create() method is called with `refresh_token=None` as an
        # argument when we specifically do not want a refresh_token.
        #
        # But if it is not None or not specified, we should generate a token since
        # that is the expected behavior... the refresh_token field on ApiToken has
        # a default of generate_token()
        #
        # TODO(mdtro): All of these if/else statements will be cleaned up at a later time
        #   to use a match statment on the AuthTokenType. Move each of the various token type
        #   create calls one at a time.
        if "refresh_token" in kwargs:
            plaintext_refresh_token = kwargs["refresh_token"]
        else:
            plaintext_refresh_token = generate_token()

        if token_type == AuthTokenType.USER:
            plaintext_token = generate_token(token_type=AuthTokenType.USER)
            plaintext_refresh_token = None  # user auth tokens do not have refresh tokens
        else:
            # to maintain compatibility with current
            # code that currently calls create with token= specified
            if "token" in kwargs:
                plaintext_token = kwargs["token"]
            else:
                plaintext_token = generate_token()

        kwargs["hashed_token"] = hashlib.sha256(plaintext_token.encode()).hexdigest()

        if plaintext_refresh_token:
            kwargs["hashed_refresh_token"] = hashlib.sha256(
                plaintext_refresh_token.encode()
            ).hexdigest()

        kwargs["token"] = plaintext_token
        kwargs["refresh_token"] = plaintext_refresh_token

        api_token = super().create(*args, **kwargs)

        # Store the plaintext tokens for one-time retrieval
        api_token._set_plaintext_token(token=plaintext_token)
        api_token._set_plaintext_refresh_token(token=plaintext_refresh_token)

        return api_token


@control_silo_model
class ApiToken(ReplicatedControlModel, HasApiScopes):
    __relocation_scope__ = {RelocationScope.Global, RelocationScope.Config}
    category = OutboxCategory.API_TOKEN_UPDATE

    # users can generate tokens without being application-bound
    application = FlexibleForeignKey("sentry.ApiApplication", null=True)
    user = FlexibleForeignKey("sentry.User")
    # Tokens can be scoped to only access a single organization.
    #
    # Failure to restrict access by the scoping organization id could enable
    # cross-organization access for untrusted third-party clients. The scoping
    # organization key should only be unset for trusted clients.
    scoping_organization_id = HybridCloudForeignKey(
        "sentry.Organization", null=True, on_delete="CASCADE"
    )
    name = models.CharField(max_length=255, null=True)
    token = models.CharField(max_length=71, unique=True, default=generate_token)
    hashed_token = models.CharField(max_length=128, unique=True, null=True)
    token_type = models.CharField(max_length=7, choices=AuthTokenType, null=True)
    token_last_characters = models.CharField(max_length=4, null=True)
    refresh_token = models.CharField(max_length=71, unique=True, null=True, default=generate_token)
    hashed_refresh_token = models.CharField(max_length=128, unique=True, null=True)
    expires_at = models.DateTimeField(null=True, default=default_expiration)
    date_added = models.DateTimeField(default=timezone.now)

    objects: ClassVar[ApiTokenManager] = ApiTokenManager(cache_fields=("token",))

    class Meta:
        app_label = "sentry"
        db_table = "sentry_apitoken"

    __repr__ = sane_repr("user_id", "token", "application_id")

    def __str__(self):
        return f"token_id={force_str(self.id)}"

    def _set_plaintext_token(self, token: str) -> None:
        """Set the plaintext token for one-time reading
        This function should only be called from the model's
        manager class.

        :param token: A plaintext string of the token
        :raises PlaintextSecretAlreadyRead: when the token has already been read once
        """
        existing_token: str | None = None
        try:
            existing_token = self.__plaintext_token
        except AttributeError:
            self.__plaintext_token: str = token

        if existing_token == TOKEN_REDACTED:
            raise PlaintextSecretAlreadyRead()

    def _set_plaintext_refresh_token(self, token: str) -> None:
        """Set the plaintext refresh token for one-time reading
        This function should only be called from the model's
        manager class.

        :param token: A plaintext string of the refresh token
        :raises PlaintextSecretAlreadyRead: if the token has already been read once
        """
        existing_refresh_token: str | None = None
        try:
            existing_refresh_token = self.__plaintext_refresh_token
        except AttributeError:
            self.__plaintext_refresh_token: str = token

        if existing_refresh_token == TOKEN_REDACTED:
            raise PlaintextSecretAlreadyRead()

    @property
    def plaintext_token(self) -> str:
        """The plaintext value of the token
        To be called immediately after creation of a new `ApiToken` to return the
        plaintext token to the user. After reading the token, the plaintext token
        string will be set to `TOKEN_REDACTED` to prevent future accidental leaking
        of the token in logs, exceptions, etc.

        :raises PlaintextSecretAlreadyRead: if the token has already been read once
        :return: the plaintext value of the token
        """
        token = self.__plaintext_token
        if token == TOKEN_REDACTED:
            raise PlaintextSecretAlreadyRead()

        self.__plaintext_token = TOKEN_REDACTED

        return token

    @property
    def plaintext_refresh_token(self) -> str:
        """The plaintext value of the refresh token
        To be called immediately after creation of a new `ApiToken` to return the
        plaintext token to the user. After reading the token, the plaintext token
        string will be set to `TOKEN_REDACTED` to prevent future accidental leaking
        of the token in logs, exceptions, etc.

        :raises PlaintextSecretAlreadyRead: if the refresh token has already been read once
        :raises NotSupported: if called on a User Auth Token
        :return: the plaintext value of the refresh token
        """
        if not self.refresh_token and not self.hashed_refresh_token:
            raise NotSupported("This API token type does not support refresh tokens")

        token = self.__plaintext_refresh_token
        if token == TOKEN_REDACTED:
            raise PlaintextSecretAlreadyRead()

        self.__plaintext_refresh_token = TOKEN_REDACTED

        return token

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.hashed_token = hashlib.sha256(self.token.encode()).hexdigest()

        if self.refresh_token:
            self.hashed_refresh_token = hashlib.sha256(self.refresh_token.encode()).hexdigest()
        else:
            # The backup tests create a token with a refresh_token and then clear it out.
            # So if the refresh_token is None, wipe out any hashed value that may exist too.
            # https://github.com/getsentry/sentry/blob/1fc699564e79c62bff6cc3c168a49bfceadcac52/tests/sentry/backup/test_imports.py#L1306
            self.hashed_refresh_token = None

        token_last_characters = self.token[-4:]
        self.token_last_characters = token_last_characters

        return super().save(*args, **kwargs)

    def update(self, *args: Any, **kwargs: Any) -> int:
        # if the token or refresh_token was updated, we need to
        # re-calculate the hashed values
        if "token" in kwargs:
            kwargs["hashed_token"] = hashlib.sha256(kwargs["token"].encode()).hexdigest()

        if "refresh_token" in kwargs:
            kwargs["hashed_refresh_token"] = hashlib.sha256(
                kwargs["refresh_token"].encode()
            ).hexdigest()

        if "token" in kwargs:
            kwargs["token_last_characters"] = kwargs["token"][-4:]

        return super().update(*args, **kwargs)

    def outbox_region_names(self) -> Collection[str]:
        return list(find_all_region_names())

    def handle_async_replication(self, region_name: str, shard_identifier: int) -> None:
        from sentry.auth.services.auth.serial import serialize_api_token
        from sentry.hybridcloud.services.replica import region_replica_service

        region_replica_service.upsert_replicated_api_token(
            api_token=serialize_api_token(self),
            region_name=region_name,
        )

    @classmethod
    def from_grant(cls, grant: ApiGrant):
        with transaction.atomic(router.db_for_write(cls)):
            api_token = cls.objects.create(
                application=grant.application,
                user=grant.user,
                scope_list=grant.get_scopes(),
                scoping_organization_id=grant.organization_id,
            )

            # remove the ApiGrant from the database to prevent reuse of the same
            # authorization code
            grant.delete()

            return api_token

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
        if self.token_type == AuthTokenType.USER:
            raise NotSupported("User auth tokens do not support refreshing the token")

        if expires_at is None:
            expires_at = timezone.now() + DEFAULT_EXPIRATION

        new_token = generate_token(token_type=self.token_type)
        new_refresh_token = generate_token(token_type=self.token_type)

        self.update(token=new_token, refresh_token=new_refresh_token, expires_at=expires_at)

    def get_relocation_scope(self) -> RelocationScope:
        if self.application_id is not None:
            # TODO(getsentry/team-ospo#188): this should be extension scope once that gets added.
            return RelocationScope.Global

        return RelocationScope.Config

    def write_relocation_import(
        self, scope: ImportScope, flags: ImportFlags
    ) -> tuple[int, ImportKind] | None:
        # If there is a token collision, generate new tokens.
        query = models.Q(token=self.token) | models.Q(
            refresh_token__isnull=False, refresh_token=self.refresh_token
        )
        existing = self.__class__.objects.filter(query).first()
        if existing:
            self.token = generate_token(token_type=self.token_type)
            if self.refresh_token is not None:
                self.refresh_token = generate_token(token_type=self.token_type)
            if self.expires_at is not None:
                self.expires_at = timezone.now() + DEFAULT_EXPIRATION

        return super().write_relocation_import(scope, flags)

    @classmethod
    def sanitize_relocation_json(
        cls,
        json: Any,
        sanitizer: Sanitizer,
        model_name: NormalizedModelName | None = None,
    ) -> None:
        model_name = get_model_name(cls) if model_name is None else model_name
        super().sanitize_relocation_json(json, sanitizer, model_name)

        token = generate_token()
        token_last_characters = token[-4:]
        hashed_token = hashlib.sha256(token.encode()).hexdigest()
        refresh_token = generate_token()
        hashed_refresh_token = hashlib.sha256(refresh_token.encode()).hexdigest()

        sanitizer.set_string(json, SanitizableField(model_name, "token"), lambda _: token)
        sanitizer.set_string(
            json,
            SanitizableField(model_name, "token_last_characters"),
            lambda _: token_last_characters,
        )
        sanitizer.set_string(
            json, SanitizableField(model_name, "hashed_token"), lambda _: hashed_token
        )
        sanitizer.set_string(
            json, SanitizableField(model_name, "refresh_token"), lambda _: refresh_token
        )
        sanitizer.set_string(
            json,
            SanitizableField(model_name, "hashed_refresh_token"),
            lambda _: hashed_refresh_token,
        )

    @property
    def organization_id(self) -> int | None:
        from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
        from sentry.sentry_apps.models.sentry_app_installation_token import (
            SentryAppInstallationToken,
        )

        if self.scoping_organization_id:
            return self.scoping_organization_id
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
    from sentry.auth.services.auth import AuthenticatedToken
    from sentry.hybridcloud.models.apitokenreplica import ApiTokenReplica

    if isinstance(auth, AuthenticatedToken):
        return auth.kind == "api_token"
    return isinstance(auth, ApiToken) or isinstance(auth, ApiTokenReplica)
