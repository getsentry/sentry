from __future__ import annotations

from datetime import datetime, timedelta

from django.contrib.postgres.fields.array import ArrayField
from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey

# Short by design: a grant shouldn't outlive the chat session that requested it by much.
DEFAULT_EXPIRATION = timedelta(hours=4)

# Upper bound for the client-supplied agent session id, matching the column width so an
# over-long value is a 400 rather than a DB DataError.
AGENT_SESSION_ID_MAX_LENGTH = 128


def default_expiration() -> datetime:
    return timezone.now() + DEFAULT_EXPIRATION


@cell_silo_model
class SeerAgentWriteGrant(DefaultFieldsModel):
    """A user's approval that lets the Seer agent hold write scopes for one org + session.

    Rows exist only for approved consent — there is no pending/declined state. One row per
    ``(organization, user, session)`` (unique-constrained); approving more scopes merges
    into that row. An unexpired row folds its write scopes into the next minted token.
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)
    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")
    # Client-supplied, but only ever narrows a lookup already filtered by the authenticated
    # user_id, so it stays IDOR-safe.
    agent_session_id = models.CharField(max_length=AGENT_SESSION_ID_MAX_LENGTH)
    scope_list = ArrayField(models.TextField(), default=list)
    expires_at = models.DateTimeField(default=default_expiration)

    class Meta:
        app_label = "seer"
        db_table = "seer_agentwritegrant"
        constraints = [
            # Also serves the mint-time lookup and makes the approval get-or-merge atomic.
            models.UniqueConstraint(
                fields=["organization", "user_id", "agent_session_id"],
                name="seer_agentwritegrant_unique_session",
            ),
        ]

    __repr__ = sane_repr("organization_id", "user_id", "agent_session_id")

    def get_scopes(self) -> list[str]:
        return self.scope_list
