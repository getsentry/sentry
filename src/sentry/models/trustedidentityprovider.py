from __future__ import annotations

import logging
from typing import Any

import orjson
import requests
from django.db import models
from django.utils import timezone

from sentry.backup.dependencies import NormalizedModelName, get_model_name
from sentry.backup.sanitize import SanitizableField, Sanitizer
from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model, control_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.utils import jwt

logger = logging.getLogger(__name__)

# Timeout for JWKS fetching
JWKS_FETCH_TIMEOUT = 10

# Allowed JWT signing algorithms (asymmetric only for security)
ALLOWED_JWT_ALGORITHMS = frozenset(("RS256", "RS384", "RS512", "ES256", "ES384", "ES512"))


class JWKSFetchError(Exception):
    """Failed to fetch JWKS from the IdP."""


class JWTValidationError(Exception):
    """JWT signature validation failed."""


class IdPDisabledError(JWTValidationError):
    """The IdP is disabled and cannot be used for validation."""


class KeyNotFoundError(JWTValidationError):
    """The key ID (kid) from the JWT was not found in the JWKS."""


@control_silo_model
class TrustedIdentityProvider(Model):
    """
    External Identity Providers trusted to issue ID-JAG (Identity Assertion JWT
    Authorization Grant) tokens for Sentry API access.

    This enables enterprise SSO-to-API flows where tools like Cursor can
    authenticate users via their enterprise IdP (Okta, Azure AD, etc.) and
    exchange ID tokens for Sentry API access tokens.

    Each organization configures which IdPs they trust, similar to how SSO
    is configured via AuthProvider.

    See: https://datatracker.ietf.org/doc/draft-ietf-oauth-identity-assertion-authz-grant/
    """

    __relocation_scope__ = RelocationScope.Global

    # Organization this IdP is trusted for (each org configures their own IdPs)
    organization_id = HybridCloudForeignKey("sentry.Organization", on_delete="cascade")

    # The IdP's issuer URL (e.g., "https://acme.okta.com")
    # This must match the `iss` claim in ID-JAG tokens
    issuer = models.CharField(max_length=512)

    # Human-readable name for display in UI
    name = models.CharField(max_length=100)

    # URL to fetch the IdP's JSON Web Key Set for signature validation
    jwks_uri = models.URLField(max_length=512)

    # Cached JWKS data to avoid fetching on every request
    jwks_cache = models.JSONField(null=True, blank=True)
    jwks_cached_at = models.DateTimeField(null=True, blank=True)

    # Which claim in the ID-JAG contains the subject identifier
    # Usually "sub" but some IdPs use "email" or custom claims
    subject_claim = models.CharField(max_length=50, default="sub")

    # Optional: claim that maps to Sentry organization (for multi-tenant IdPs)
    tenant_claim = models.CharField(max_length=50, null=True, blank=True)

    # Restrict which client_ids can use this IdP for ID-JAG
    # Empty list means all registered clients are allowed
    allowed_client_ids = models.JSONField(default=list)

    # Maximum scopes that can be granted via this IdP
    # Empty list means no scope restrictions (use client's allowed scopes)
    allowed_scopes = models.JSONField(default=list)

    # Whether this IdP is currently enabled for ID-JAG
    enabled = models.BooleanField(default=True)

    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_trustedidentityprovider"
        unique_together = (("organization_id", "issuer"),)

    __repr__ = sane_repr("organization_id", "issuer", "name")

    def __str__(self) -> str:
        return f"{self.name} ({self.issuer})"

    def is_jwks_cache_valid(self, max_age_seconds: int = 3600) -> bool:
        """Check if JWKS cache is still valid (default 1 hour TTL)."""
        if self.jwks_cache is None or self.jwks_cached_at is None:
            return False
        age = timezone.now() - self.jwks_cached_at
        return age.total_seconds() < max_age_seconds

    def update_jwks_cache(self, jwks_data: dict) -> None:
        """Update the cached JWKS data."""
        self.jwks_cache = jwks_data
        self.jwks_cached_at = timezone.now()
        self.save(update_fields=["jwks_cache", "jwks_cached_at"])

    def is_client_allowed(self, client_id: str) -> bool:
        """Check if a client_id is allowed to use this IdP for ID-JAG."""
        if not self.allowed_client_ids:
            return True  # Empty list = all clients allowed
        # Ensure allowed_client_ids is a list to prevent substring matching
        if not isinstance(self.allowed_client_ids, list):
            logger.warning(
                "allowed_client_ids is not a list, rejecting client",
                extra={
                    "idp_id": self.id,
                    "issuer": self.issuer,
                    "type": type(self.allowed_client_ids).__name__,
                },
            )
            return False
        return client_id in self.allowed_client_ids

    def get_audit_log_data(self) -> dict[str, Any]:
        return {
            "organization_id": self.organization_id,
            "issuer": self.issuer,
            "name": self.name,
            "jwks_uri": self.jwks_uri,
            "enabled": self.enabled,
        }

    @classmethod
    def sanitize_relocation_json(
        cls, json: Any, sanitizer: Sanitizer, model_name: NormalizedModelName | None = None
    ) -> None:
        model_name = get_model_name(cls) if model_name is None else model_name
        super().sanitize_relocation_json(json, sanitizer, model_name)

        # Clear cached JWKS data and configuration
        sanitizer.set_json(json, SanitizableField(model_name, "jwks_cache"), None)
        sanitizer.set_json(json, SanitizableField(model_name, "allowed_client_ids"), [])
        sanitizer.set_json(json, SanitizableField(model_name, "allowed_scopes"), [])

    def fetch_jwks(self) -> dict[str, Any]:
        """
        Fetch the JWKS from the IdP's jwks_uri and update the cache.

        Returns the fetched JWKS data.
        Raises JWKSFetchError if the fetch fails.
        """
        try:
            response = requests.get(self.jwks_uri, timeout=JWKS_FETCH_TIMEOUT)
            response.raise_for_status()
        except requests.RequestException as e:
            logger.warning(
                "Failed to fetch JWKS from %s: %s",
                self.jwks_uri,
                str(e),
                extra={"idp_id": self.id, "issuer": self.issuer},
            )
            raise JWKSFetchError(f"Failed to fetch JWKS from {self.jwks_uri}: {e}") from e

        try:
            jwks_data = response.json()
        except (ValueError, requests.exceptions.JSONDecodeError) as e:
            logger.warning(
                "Invalid JSON in JWKS response from %s",
                self.jwks_uri,
                extra={"idp_id": self.id, "issuer": self.issuer},
            )
            raise JWKSFetchError(f"Invalid JSON in JWKS response from {self.jwks_uri}") from e

        if "keys" not in jwks_data:
            logger.warning(
                "JWKS response from %s missing required 'keys' field",
                self.jwks_uri,
                extra={"idp_id": self.id, "issuer": self.issuer},
            )
            raise JWKSFetchError(f"JWKS response from {self.jwks_uri} missing 'keys' field")

        # Validate keys is a list
        if not isinstance(jwks_data["keys"], list):
            logger.warning(
                "JWKS response from %s has invalid 'keys' field type",
                self.jwks_uri,
                extra={
                    "idp_id": self.id,
                    "issuer": self.issuer,
                    "type": type(jwks_data["keys"]).__name__,
                },
            )
            raise JWKSFetchError(f"JWKS response from {self.jwks_uri} 'keys' field must be a list")

        self.update_jwks_cache(jwks_data)
        return jwks_data

    def get_public_key(self, kid: str) -> str:
        """
        Get a public key from the cached JWKS by key ID (kid).

        Returns the key in PEM format suitable for JWT verification.
        Supports both RSA (kty=RSA) and EC (kty=EC) key types.
        Raises KeyNotFoundError if the key is not found.
        """
        if not self.jwks_cache or "keys" not in self.jwks_cache:
            raise KeyNotFoundError(f"No JWKS cache available for IdP {self.issuer}")

        for jwk in self.jwks_cache["keys"]:
            if jwk.get("kid") == kid:
                # Convert JWK to PEM format based on key type
                try:
                    jwk_json = orjson.dumps(jwk).decode()
                    kty = jwk.get("kty", "RSA")
                    if kty == "RSA":
                        return jwt.rsa_key_from_jwk(jwk_json)
                    elif kty == "EC":
                        return jwt.ec_key_from_jwk(jwk_json)
                    else:
                        raise JWTValidationError(f"Unsupported key type '{kty}' for key ID '{kid}'")
                except (ValueError, TypeError) as e:
                    logger.warning(
                        "Failed to convert JWK to PEM format for key %s",
                        kid,
                        extra={
                            "idp_id": self.id,
                            "issuer": self.issuer,
                            "kid": kid,
                            "kty": jwk.get("kty"),
                        },
                        exc_info=True,
                    )
                    raise JWTValidationError(f"Invalid key format for key ID '{kid}': {e}") from e

        raise KeyNotFoundError(f"Key ID '{kid}' not found in JWKS for IdP {self.issuer}")

    def validate_jwt_signature(
        self,
        token: str,
        *,
        audience: str | None = None,
        refresh_on_missing_key: bool = True,
    ) -> dict[str, Any]:
        """
        Validate a JWT's signature using the IdP's cached JWKS.

        This validates the cryptographic signature of the token but does NOT
        validate business logic claims like issuer, subject mapping, or client_id.
        Those validations should be done by the caller.

        Args:
            token: The JWT string to validate.
            audience: Expected audience claim. Pass None to skip audience validation.
            refresh_on_missing_key: If True and the key ID is not found in the cache,
                refresh the JWKS and retry once.

        Returns:
            The decoded JWT claims (payload) if validation succeeds.

        Raises:
            JWTValidationError: If signature validation fails.
            IdPDisabledError: If the IdP is disabled.
            KeyNotFoundError: If the key ID is not found in JWKS (after refresh if enabled).
            JWKSFetchError: If JWKS refresh fails.
        """
        # Check if IdP is enabled
        if not self.enabled:
            logger.warning(
                "JWT validation attempted on disabled IdP",
                extra={"idp_id": self.id, "issuer": self.issuer},
            )
            raise IdPDisabledError(f"IdP {self.issuer} is disabled")

        # Ensure we have a cached JWKS
        if not self.is_jwks_cache_valid():
            self.fetch_jwks()

        # Get the key ID from the token header
        try:
            header = jwt.peek_header(token)
        except jwt.DecodeError as e:
            logger.warning(
                "JWT validation failed: invalid token format",
                extra={"idp_id": self.id, "issuer": self.issuer},
            )
            raise JWTValidationError(f"Invalid JWT format: {e}") from e

        kid = header.get("kid")
        if not kid:
            logger.warning(
                "JWT validation failed: missing 'kid' header",
                extra={"idp_id": self.id, "issuer": self.issuer},
            )
            raise JWTValidationError("JWT header missing 'kid' (key ID)")

        alg = header.get("alg", "RS256")
        if alg not in ALLOWED_JWT_ALGORITHMS:
            logger.warning(
                "JWT validation failed: unsupported algorithm %s",
                alg,
                extra={"idp_id": self.id, "issuer": self.issuer, "algorithm": alg},
            )
            raise JWTValidationError(f"Unsupported JWT algorithm: {alg}")

        # Try to get the public key
        try:
            public_key = self.get_public_key(kid)
        except KeyNotFoundError:
            if refresh_on_missing_key:
                # Key not found - might be a key rotation, refresh JWKS and retry
                logger.info(
                    "Key ID not found in cache, refreshing JWKS",
                    extra={"idp_id": self.id, "issuer": self.issuer, "kid": kid},
                )
                self.fetch_jwks()
                public_key = self.get_public_key(kid)
            else:
                raise

        # Validate the JWT signature
        try:
            claims = jwt.decode(
                token,
                public_key,
                algorithms=[alg],
                audience=audience or False,
            )
        except jwt.DecodeError as e:
            logger.warning(
                "JWT signature validation failed",
                extra={"idp_id": self.id, "issuer": self.issuer, "kid": kid, "algorithm": alg},
                exc_info=True,
            )
            raise JWTValidationError(f"JWT signature validation failed: {e}") from e

        return claims
