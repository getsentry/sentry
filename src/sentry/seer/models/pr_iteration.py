from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel


@cell_silo_model
class PendingPullRequestIteration(DefaultFieldsModel):
    """
    Queued PR iteration triggered by code review feedback or CI failure.
    A periodic task polls rows where process_after < now() and dispatches
    an iteration task for each. Rows are deleted after successful processing.
    """

    __relocation_scope__ = RelocationScope.Excluded

    pull_request = FlexibleForeignKey("sentry.PullRequest", on_delete=models.CASCADE)
    integration = FlexibleForeignKey("sentry.Integration", on_delete=models.CASCADE)
    process_after = models.DateTimeField()
    extras = models.JSONField(db_default={}, default=dict)

    class Meta:
        app_label = "seer"
        db_table = "seer_pendingpullrequestiteration"
        indexes = [
            models.Index(fields=["process_after"]),
        ]

    __repr__ = sane_repr("pull_request_id", "process_after")
