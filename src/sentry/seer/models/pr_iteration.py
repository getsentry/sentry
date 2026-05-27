from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    cell_silo_model,
    sane_repr,
)
from sentry.db.models.base import Model


@cell_silo_model
class PendingPullRequestIteration(Model):
    """
    Queued PR iteration triggered by code review feedback or CI failure.
    A periodic task polls rows where process_after < now() and dispatches
    an iteration task for each. Rows are deleted after successful processing.
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)
    repository_id = BoundedPositiveIntegerField()
    pr_key = models.CharField(max_length=64)
    process_after = models.DateTimeField()
    extras = models.JSONField(db_default={}, default=dict)

    class Meta:
        app_label = "seer"
        db_table = "seer_pendingpullrequestiteration"
        indexes = [
            models.Index(fields=["process_after"]),
        ]

    __repr__ = sane_repr("organization_id", "repository_id", "pr_key", "process_after")
