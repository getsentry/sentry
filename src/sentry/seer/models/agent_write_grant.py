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

# How long an approved grant stays usable. Short by design: a grant is the user's
# standing approval for the agent to hold a write scope, so it should not outlive the
# chat session that requested it by much. Prototype default; revisit with product.
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
    A user's approval that lets the Seer agent hold a specific set of write scopes
    against one organization, for one agent session, for a limited time.

    The agent acts with a short-lived, scope-bound capability token (see
    ``sentry.seer.agent_token``). The token defaults to read-only; an ``approved``,
    unexpired grant is what folds a write scope into the next minted token. A grant
    is created in ``pending`` status when a write is challenged, and the acting user
    approves it through the approval API.

    This is a permission *record*, not a credential: it carries no token and is
    useless to anyone who is not the bound user acting within the bound org.
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)
    # The user the agent is acting on behalf of. All approval/lookup decisions are
    # bound to this id (never to client-supplied input) to stay IDOR-safe.
    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")
    # The agent (chat) session the approval belongs to. An approval in one session
    # does not silently empower another. Client-supplied, but only ever narrows a
    # lookup already filtered by the authenticated user_id, so it is IDOR-safe.
    agent_session_id = models.CharField(max_length=128)
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
            # Mint-time lookup: "active grants for this user + org + session?"
            models.Index(fields=["organization", "user_id", "agent_session_id", "status"]),
        ]

    __repr__ = sane_repr("organization_id", "user_id", "agent_session_id", "status")

    def get_scopes(self) -> list[str]:
        return self.scope_list
