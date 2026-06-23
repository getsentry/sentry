from __future__ import annotations

import secrets
from datetime import datetime, timedelta

from django.contrib.postgres.fields.array import ArrayField
from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey

# How long a challenge / approval stays usable. Short by design: a grant is the
# agent's standing permission to write, so it should not outlive the chat session
# that requested it by much. Prototype default; revisit with product.
DEFAULT_EXPIRATION = timedelta(hours=4)


class AgentWriteGrantStatus:
    PENDING = "pending"
    APPROVED = "approved"
    DECLINED = "declined"

    CHOICES = (
        (PENDING, "pending"),
        (APPROVED, "approved"),
        (DECLINED, "declined"),
    )


def default_expiration() -> datetime:
    return timezone.now() + DEFAULT_EXPIRATION


def generate_nonce() -> str:
    # 256 bits of entropy; the nonce is single-use and identity-bound, but we
    # never want it to be guessable either.
    return secrets.token_hex(nbytes=32)


@cell_silo_model
class SeerAgentWriteGrant(DefaultFieldsModel):
    """
    A user's approval that lets the Seer agent perform a specific set of write
    scopes against one organization, for a limited time.

    The agent's mutating requests are masked to read-only unless an `approved`,
    unexpired grant covers the required scope (see `sentry.seer.agent_write_gate`).
    A grant is created in `pending` status when a write is challenged, and the
    acting user approves it through the approval API.

    This is a permission *record*, not a credential: it carries no token and is
    useless to anyone who is not the bound user acting within the bound org.
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)
    # The user the agent is acting on behalf of. All approval/lookup decisions are
    # bound to this id (never to client-supplied input) to stay IDOR-safe.
    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")
    nonce = models.CharField(max_length=64, unique=True, default=generate_nonce)
    scope_list = ArrayField(models.TextField(), default=list)
    status = models.CharField(
        max_length=16,
        choices=AgentWriteGrantStatus.CHOICES,
        default=AgentWriteGrantStatus.PENDING,
    )
    # Human-readable description of the operation that triggered the challenge,
    # shown to the user in the approval prompt.
    operation = models.TextField(null=True)
    expires_at = models.DateTimeField(default=default_expiration)
    approved_at = models.DateTimeField(null=True)

    class Meta:
        app_label = "seer"
        db_table = "seer_agentwritegrant"
        indexes = [
            # Request-time lookup: "is there an active grant for this user+org?"
            models.Index(fields=["organization", "user_id", "status"]),
        ]

    __repr__ = sane_repr("organization_id", "user_id", "status")

    def get_scopes(self) -> list[str]:
        return self.scope_list

    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    def is_active(self) -> bool:
        return self.status == AgentWriteGrantStatus.APPROVED and not self.is_expired()
