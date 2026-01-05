from __future__ import annotations

import secrets
from datetime import timedelta
from typing import Any

from django.contrib.postgres.fields.array import ArrayField
from django.db import IntegrityError, models
from django.utils import timezone

from sentry.backup.dependencies import NormalizedModelName, get_model_name
from sentry.backup.sanitize import SanitizableField, Sanitizer
from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, control_silo_model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey

# RFC 8628 recommends short lifetimes for device codes (10-15 minutes)
DEFAULT_EXPIRATION = timedelta(minutes=10)

# Default polling interval in seconds (RFC 8628 §3.2)
DEFAULT_INTERVAL = 5

# Base-20 alphabet for user codes: excludes ambiguous characters (0/O, 1/I/L, etc.)
# This provides ~34 bits of entropy for 8-character codes, sufficient with rate limiting.
# Reference: RFC 8628 §5.1
USER_CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ"
USER_CODE_LENGTH = 8


def default_expiration():
    return timezone.now() + DEFAULT_EXPIRATION


def generate_device_code():
    """Generate a cryptographically secure device code (256-bit entropy)."""
    return secrets.token_hex(nbytes=32)


def generate_user_code():
    """
    Generate a human-readable user code in format "XXXX-XXXX".

    Uses base-20 alphabet to avoid ambiguous characters, providing ~34 bits
    of entropy which is sufficient when combined with rate limiting.
    Reference: RFC 8628 §5.1
    """
    chars = [secrets.choice(USER_CODE_ALPHABET) for _ in range(USER_CODE_LENGTH)]
    return f"{''.join(chars[:4])}-{''.join(chars[4:])}"


# Maximum retries for generating unique codes
MAX_CODE_GENERATION_RETRIES = 10


class UserCodeCollisionError(Exception):
    """Raised when unable to generate a unique user code after maximum retries."""

    pass


class DeviceCodeStatus:
    """Status values for device authorization codes."""

    PENDING = "pending"
    APPROVED = "approved"
    DENIED = "denied"


@control_silo_model
class ApiDeviceCode(Model):
    """
    Device authorization code for OAuth 2.0 Device Flow (RFC 8628).

    This model stores the state of a device authorization request, which allows
    headless devices (CLIs, Docker containers, CI/CD jobs) to obtain OAuth tokens
    by having users authorize on a separate device with a browser.

    Flow:
    1. Device requests authorization via POST /oauth/device_authorization
    2. Server returns device_code (secret) and user_code (human-readable)
    3. Device displays user_code and verification_uri to user
    4. Device polls POST /oauth/token with device_code
    5. User visits verification_uri, enters user_code, and approves/denies
    6. On approval, device receives access token on next poll

    Reference: https://datatracker.ietf.org/doc/html/rfc8628
    """

    __relocation_scope__ = RelocationScope.Global

    # Device code: secret, high-entropy code used for token polling (RFC 8628 §3.2)
    device_code = models.CharField(max_length=64, unique=True, default=generate_device_code)

    # User code: human-readable code for user entry (RFC 8628 §3.2)
    # Format: "XXXX-XXXX" using base-20 alphabet
    # Must be unique since users look up by this code
    user_code = models.CharField(max_length=16, unique=True, default=generate_user_code)

    # The OAuth application requesting authorization
    application = FlexibleForeignKey("sentry.ApiApplication")

    # User who approved the request (set when status changes to APPROVED)
    user = FlexibleForeignKey("sentry.User", null=True, on_delete=models.CASCADE)

    # Organization selected during approval (for org-level access apps)
    organization_id = HybridCloudForeignKey(
        "sentry.Organization",
        db_index=True,
        null=True,
        on_delete="CASCADE",
    )

    # Requested scopes (space-delimited in requests, stored as array)
    scope_list = ArrayField(models.TextField(), default=list)

    # When this device code expires (RFC 8628 §3.2 expires_in)
    expires_at = models.DateTimeField(db_index=True, default=default_expiration)

    # Authorization status: pending -> approved/denied
    status = models.CharField(max_length=20, default=DeviceCodeStatus.PENDING)

    # Timestamps
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_apidevicecode"

    def __str__(self) -> str:
        return f"device_code={self.id}, application={self.application_id}, status={self.status}"

    def get_scopes(self) -> list[str]:
        """Return the list of requested scopes."""
        return self.scope_list

    def has_scope(self, scope: str) -> bool:
        """Check if a specific scope was requested."""
        return scope in self.scope_list

    def is_expired(self) -> bool:
        """Check if the device code has expired."""
        return timezone.now() >= self.expires_at

    def is_pending(self) -> bool:
        """Check if the device code is still awaiting user action."""
        return self.status == DeviceCodeStatus.PENDING

    def is_approved(self) -> bool:
        """Check if the user has approved this device code."""
        return self.status == DeviceCodeStatus.APPROVED

    def is_denied(self) -> bool:
        """Check if the user has denied this device code."""
        return self.status == DeviceCodeStatus.DENIED

    @classmethod
    def get_lock_key(cls, device_code_id: int) -> str:
        """Return lock key for preventing race conditions during token exchange."""
        return f"api_device_code:{device_code_id}"

    @classmethod
    def sanitize_relocation_json(
        cls, json: Any, sanitizer: Sanitizer, model_name: NormalizedModelName | None = None
    ) -> None:
        model_name = get_model_name(cls) if model_name is None else model_name
        super().sanitize_relocation_json(json, sanitizer, model_name)

        sanitizer.set_string(
            json, SanitizableField(model_name, "device_code"), lambda _: generate_device_code()
        )
        sanitizer.set_string(
            json, SanitizableField(model_name, "user_code"), lambda _: generate_user_code()
        )

    @classmethod
    def create_with_retry(cls, application, scope_list: list[str] | None = None) -> ApiDeviceCode:
        """
        Create a new device code with retry logic for user code collisions.

        Since user codes have ~34 bits of entropy, collisions are rare but possible.
        This method retries with new codes if a collision occurs.

        Args:
            application: The ApiApplication requesting authorization
            scope_list: Optional list of requested scopes

        Returns:
            A new ApiDeviceCode instance

        Raises:
            UserCodeCollisionError: If unable to generate a unique code after max retries
        """
        if scope_list is None:
            scope_list = []

        for attempt in range(MAX_CODE_GENERATION_RETRIES):
            try:
                return cls.objects.create(
                    application=application,
                    scope_list=scope_list,
                )
            except IntegrityError:
                # Collision on device_code or user_code, try again
                if attempt == MAX_CODE_GENERATION_RETRIES - 1:
                    raise UserCodeCollisionError(
                        f"Unable to generate unique device code after {MAX_CODE_GENERATION_RETRIES} attempts"
                    )
                continue

        # This should never be reached, but satisfies type checker
        raise UserCodeCollisionError("Unable to generate unique device code")
