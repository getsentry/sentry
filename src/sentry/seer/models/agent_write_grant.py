from __future__ import annotations

from datetime import datetime, timedelta

from django.contrib.postgres.fields.array import ArrayField
from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey

# How long an approved grant stays usable. Short by design: a grant is the user's standing
# approval for the agent to hold a write scope, so it should not outlive the chat session
# that requested it by much. Prototype default; revisit with product.
DEFAULT_EXPIRATION = timedelta(hours=4)

# Upper bound for the client-supplied agent session id, matching the column width so an
# over-long value is a 400 rather than a DB DataError.
AGENT_SESSION_ID_MAX_LENGTH = 128


def default_expiration() -> datetime:
    return timezone.now() + DEFAULT_EXPIRATION


@cell_silo_model
class SeerAgentWriteGrant(DefaultFieldsModel):
    """
    A user's approval that lets the Seer agent hold write scopes against one organization,
    for one agent session, for a limited time.

    Created only when the user approves via the approval endpoint, so this table holds
    approved consent only — no pending/declined state. Exactly one row per
    ``(organization, user, session)`` (unique-constrained); approving more scopes merges
    into that row. An unexpired grant is what folds a write scope into the next minted
    capability token.

    A permission *record*, not a credential: it carries no token and is useless to anyone
    who is not the bound user acting within the bound org and session.
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)
    # The user the agent is acting on behalf of. All lookup decisions are bound to this id
    # (never to client-supplied input) to stay IDOR-safe.
    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")
    # The agent (chat) session the approval belongs to. An approval in one session does not
    # silently empower another. Client-supplied, but only ever narrows a lookup already
    # filtered by the authenticated user_id, so it is IDOR-safe.
    agent_session_id = models.CharField(max_length=AGENT_SESSION_ID_MAX_LENGTH)
    scope_list = ArrayField(models.TextField(), default=list)
    expires_at = models.DateTimeField(default=default_expiration)

    class Meta:
        app_label = "seer"
        db_table = "seer_agentwritegrant"
        constraints = [
            # One grant per session; also serves the mint-time lookup. Makes the approval
            # get-or-merge atomic and idempotent instead of accreting duplicate rows.
            models.UniqueConstraint(
                fields=["organization", "user_id", "agent_session_id"],
                name="seer_agentwritegrant_unique_session",
            ),
        ]

    __repr__ = sane_repr("organization_id", "user_id", "agent_session_id")

    def get_scopes(self) -> list[str]:
        return self.scope_list
