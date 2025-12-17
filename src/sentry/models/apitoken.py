from __future__ import annotations

import base64
import hashlib
import re
import secrets
from collections.abc import Collection, Mapping
from datetime import timedelta
from typing import Any, ClassVar, TypeGuard

from django.db import models, router, transaction
from django.utils import timezone
from django.utils.crypto import constant_time_compare
from django.utils.encoding import force_str

from sentry.auth.services.auth import AuthenticatedToken
from sentry.backup.dependencies import ImportKind, NormalizedModelName, get_model_name
from sentry.backup.helpers import ImportFlags
from sentry.backup.sanitize import SanitizableField, Sanitizer
from sentry.backup.scopes import ImportScope, RelocationScope
from sentry.constants import SentryAppStatus
from sentry.db.models import FlexibleForeignKey, control_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.hybridcloud.models import ApiTokenReplica
from sentry.hybridcloud.outbox.base import ControlOutboxProducingManager, ReplicatedControlModel
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.locks import locks
from sentry.models.apiapplication import ApiApplicationStatus
from sentry.models.apigrant import ApiGrant, ExpiredGrantError, InvalidGrantError
from sentry.models.apiscopes import HasApiScopes
from sentry.silo.safety import unguarded_write
from sentry.types.region import find_all_region_names
from sentry.types.token import AuthTokenType
from sentry.utils.locking import UnableToAcquireLock

DEFAULT_EXPIRATION = timedelta(days=30)
TOKEN_REDACTED = "***REDACTED***"

# RFC 7636 §4.1: code_verifier is 43-128 unreserved characters
# ABNF: code-verifier = 43*128unreserved
# unreserved = ALPHA / DIGIT / "-" / "." / "_" / "~"
CODE_VERIFIER_REGEX = re.compile(r"^[A-Za-z0-9\-._~]{43,128}$")


def validate_pkce_challenge(
    code_challenge: str | None,
    code_challenge_method: str | None,
    code_verifier: str | None,
) -> tuple[bool, str | None]:
    """Validate PKCE code_verifier against the stored challenge.

    RFC 7636 §4.6: The authorization server MUST verify the code_verifier as follows:
    - If code_challenge_method is S256, compute BASE64URL(SHA256(code_verifier))
      and compare to code_challenge
    - If code_challenge_method is plain, compare code_verifier directly to code_challenge

    Args:
        code_challenge: The challenge stored in the grant
        code_challenge_method: The method used (S256 or plain)
        code_verifier: The verifier string provided by the client

    Returns:
        (is_valid, error_reason) tuple where:
        - is_valid: True if validation passes, False otherwise
        - error_reason: None if valid, descriptive error string if invalid

    Reference:
        https://datatracker.ietf.org/doc/html/rfc7636#section-4.6
    """
    if code_challenge is None:
        # No PKCE challenge was provided during authorization, so no verification needed
        return True, None

    # If a challenge exists, verifier is required
    if not code_verifier:
        return False, "PKCE verifier required"

    # Require S256 method explicitly (plain method not supported for security)
    if code_challenge_method != "S256":
        return False, f"unsupported challenge method: {code_challenge_method}"

    # Validate verifier format per RFC 7636 §4.1
    if not CODE_VERIFIER_REGEX.match(code_verifier):
        return False, "invalid code_verifier format"

    # RFC 7636 §4.6: BASE64URL(SHA256(ASCII(code_verifier)))
    verifier_hash = hashlib.sha256(code_verifier.encode("ascii")).digest()
    # Base64url encoding without padding
    computed_challenge = base64.urlsafe_b64encode(verifier_hash).decode("ascii").rstrip("=")

    # Use constant-time comparison to prevent timing attacks (RFC 7636 security considerations)
    if not constant_time_compare(computed_challenge, code_challenge):
        return False, "PKCE verification failed"

    return True, None


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
    token_type = models.CharField(max_length=7, choices=AuthTokenType.choices(), null=True)
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

    def __str__(self) -> str:
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
    def handle_async_deletion(
        cls,
        identifier: int,
        region_name: str,
        shard_identifier: int,
        payload: Mapping[str, Any] | None,
    ) -> None:
        from sentry.hybridcloud.services.replica import region_replica_service

        region_replica_service.delete_replicated_api_token(
            apitoken_id=identifier,
            region_name=region_name,
        )

    @classmethod
    def from_grant(
        cls,
        grant: ApiGrant,
        redirect_uri: str | None = None,
        code_verifier: str | None = None,
    ):
        """Create an ApiToken from an ApiGrant with full OAuth2 validation.

        This method performs comprehensive validation including:
        - Application status verification
        - Grant expiry checks
        - redirect_uri binding (RFC 6749 §4.1.3)
        - PKCE verification (RFC 7636 §4.6)

        All validations occur inside a lock to prevent TOCTOU race conditions.
        Failed validation attempts invalidate the grant per RFC 6749 §10.5.

        Args:
            grant: The authorization grant to exchange for a token
            redirect_uri: Must match grant.redirect_uri if grant has one bound
            code_verifier: Required if grant.code_challenge exists (PKCE)

        Returns:
            The created ApiToken

        Raises:
            InvalidGrantError: If validation fails for any reason
            ExpiredGrantError: If the grant has expired
        """
        lock = locks.get(
            ApiGrant.get_lock_key(grant.id),
            duration=10,
            name="api_grant",
        )

        try:
            with lock.acquire():
                # Re-fetch grant inside lock to prevent TOCTOU race condition
                # Another request may have already deleted the grant before we acquired the lock
                try:
                    grant = ApiGrant.objects.select_related("application").get(id=grant.id)
                except ApiGrant.DoesNotExist:
                    raise InvalidGrantError("grant no longer exists")

                # Re-validate inside lock to prevent race conditions
                if grant.application.status != ApiApplicationStatus.active:
                    with unguarded_write(using=router.db_for_write(ApiGrant)):
                        grant.delete()
                    raise InvalidGrantError("application not active")

                if grant.is_expired():
                    with unguarded_write(using=router.db_for_write(ApiGrant)):
                        grant.delete()
                    raise ExpiredGrantError("grant expired")

                # Validate redirect_uri binding (RFC 6749 §4.1.3)
                # Only validate if redirect_uri was provided in the token request (not None)
                # This maintains backward compatibility with direct from_grant() calls
                if (
                    redirect_uri is not None
                    and grant.redirect_uri
                    and grant.redirect_uri != redirect_uri
                ):
                    # RFC 6749 §10.5: Authorization codes are single-use and must be invalidated
                    # on failed exchange attempts to prevent authorization code replay attacks
                    with unguarded_write(using=router.db_for_write(ApiGrant)):
                        grant.delete()
                    raise InvalidGrantError("invalid redirect URI")

                # Validate PKCE (RFC 7636 §4.6)
                is_valid, error_reason = validate_pkce_challenge(
                    grant.code_challenge,
                    grant.code_challenge_method,
                    code_verifier,
                )
                if not is_valid:
                    # RFC 6749 §10.5: Authorization codes are single-use and must be invalidated
                    # on failed exchange attempts to prevent brute-force attacks on PKCE verifiers
                    with unguarded_write(using=router.db_for_write(ApiGrant)):
                        grant.delete()
                    raise InvalidGrantError(error_reason)

                # Create token and delete grant atomically
                with transaction.atomic(router.db_for_write(cls)):
                    api_token = cls.objects.create(
                        application=grant.application,
                        user=grant.user,
                        scope_list=grant.get_scopes(),
                        scoping_organization_id=grant.organization_id,
                    )

                    # Remove the ApiGrant from the database to prevent reuse of the same
                    # authorization code (RFC 6749 §10.5: single-use requirement)
                    with unguarded_write(using=router.db_for_write(ApiGrant)):
                        grant.delete()

                return api_token

        except UnableToAcquireLock:
            # If we can't acquire the lock, another request is currently processing this grant.
            # That request will handle deletion (RFC 6749 §10.5 single-use requirement).
            # We should not delete here as it could interfere with the lock holder.
            raise InvalidGrantError("grant already in use")

    def is_expired(self):
        if not self.expires_at:
            return False

        return timezone.now() >= self.expires_at

    def get_audit_log_data(self):
        return {"scopes": self.get_scopes()}

    def get_allowed_origins(self) -> list[str]:
        if self.application:
            return self.application.get_allowed_origins()
        return []

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


def is_api_token_auth(auth: object) -> TypeGuard[AuthenticatedToken | ApiToken | ApiTokenReplica]:
    """:returns True when an API token is hitting the API."""
    from sentry.auth.services.auth import AuthenticatedToken
    from sentry.hybridcloud.models.apitokenreplica import ApiTokenReplica

    if isinstance(auth, AuthenticatedToken):
        return auth.kind == "api_token"
    return isinstance(auth, ApiToken) or isinstance(auth, ApiTokenReplica)
