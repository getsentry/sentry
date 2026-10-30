from __future__ import annotations

import secrets
from base64 import b64encode
from collections.abc import Sequence
from datetime import datetime, timedelta
from typing import TYPE_CHECKING

from django.contrib.postgres.fields.array import ArrayField
from django.db import models, router, transaction
from django.utils import timezone

from sentry import options
from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, Model, control_silo_model
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.utils import hashlib, json

if TYPE_CHECKING:
    from sentry.models.apiapplication import ApiApplication

SETUP_CODE_PREFIX = "sntryc_"

DEFAULT_EXPIRATION = timedelta(minutes=5)

SETUP_CODE_SECRET_BYTES = 32


def default_expiration() -> datetime:
    return timezone.now() + DEFAULT_EXPIRATION


def hash_setup_code(code: str) -> str:
    return hashlib.sha256_text(code).hexdigest()


def generate_setup_code() -> str:
    """
    Generate a setup code in the same shape as org auth tokens:
    `sntryc_<base64 JSON claim>_<secret>`.

    The claim is unsigned and only tells clients which Sentry instance to
    redeem the code against. The secret carries 256 bits of entropy.
    """
    sentry_url = options.get("system.url-prefix")
    if not sentry_url:
        raise ValueError("system.url-prefix must be set to generate setup codes")

    payload = {"iat": timezone.now().timestamp(), "url": sentry_url}
    payload_encoded = b64encode(json.dumps(payload).encode("utf-8")).decode("ascii")
    secret = b64encode(secrets.token_bytes(SETUP_CODE_SECRET_BYTES)).decode("ascii").rstrip("=")
    return f"{SETUP_CODE_PREFIX}{payload_encoded}_{secret}"


@control_silo_model
class ApiSetupCode(Model):
    """
    A short-lived, single-use code minted by a signed-in user and exchanged at
    `/oauth/token/` for an OAuth token through the
    `urn:sentry:params:oauth:grant-type:setup_code` grant.

    This lets a headless client (for example `curl ... | SENTRY_SETUP_CODE=... bash`)
    obtain a token without running the device flow. Only the hash of the code
    is stored, and minting a new code for a user revokes their unredeemed codes.
    """

    __relocation_scope__ = RelocationScope.Excluded

    hashed_code = models.CharField(max_length=64, unique=True)

    # The OAuth application the code can be redeemed for
    application = FlexibleForeignKey("sentry.ApiApplication")

    # User who minted the code; the issued token belongs to this user
    user = FlexibleForeignKey("sentry.User", on_delete=models.CASCADE)

    # Organization selected when minting (for org-level access apps)
    organization_id = HybridCloudForeignKey(
        "sentry.Organization",
        db_index=True,
        null=True,
        on_delete="CASCADE",
    )

    scope_list = ArrayField(models.TextField(), default=list)

    expires_at = models.DateTimeField(db_index=True, default=default_expiration)

    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_apisetupcode"

    def __str__(self) -> str:
        return f"id={self.id}, application={self.application_id}, user={self.user_id}"

    def get_scopes(self) -> list[str]:
        return self.scope_list

    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    @classmethod
    def mint(
        cls,
        application: ApiApplication,
        user_id: int,
        scope_list: Sequence[str],
        organization_id: int | None,
    ) -> tuple[ApiSetupCode, str]:
        """
        Create a setup code for the user and revoke any of their unredeemed
        codes. Returns the model and the plaintext code, which is not stored.
        """
        code = generate_setup_code()
        with transaction.atomic(router.db_for_write(cls)):
            cls.objects.filter(user_id=user_id).delete()
            setup_code = cls.objects.create(
                hashed_code=hash_setup_code(code),
                application=application,
                user_id=user_id,
                organization_id=organization_id,
                scope_list=list(scope_list),
            )
        return setup_code, code
