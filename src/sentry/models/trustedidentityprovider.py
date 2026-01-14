from __future__ import annotations

from typing import Any

from django.db import models
from django.utils import timezone

from sentry.backup.dependencies import NormalizedModelName, get_model_name
from sentry.backup.sanitize import SanitizableField, Sanitizer
from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model, control_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


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
