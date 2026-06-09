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
class PullRequestIteration(Model):
    """
    A single iteration of an automated PR update cycle.
    Groups the feedback that triggered this iteration and tracks
    when it should be processed.
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)
    repository_id = BoundedPositiveIntegerField()
    pr_key = models.CharField(max_length=64)
    process_after = models.DateTimeField()

    class Meta:
        app_label = "seer"
        db_table = "seer_pullrequestiteration"
        indexes = [
            models.Index(fields=["organization", "repository_id", "pr_key"]),
            models.Index(fields=["process_after"]),
        ]

    __repr__ = sane_repr("organization_id", "repository_id", "pr_key")


class IterationFeedbackType(models.TextChoices):
    REVIEW = "review"
    MENTION = "mention"
    CI = "ci"
    MANUAL = "manual"


@cell_silo_model
class IterationFeedback(Model):
    """
    A piece of feedback that belongs to a PullRequestIteration.
    Type identifies the feedback source, and ref points to the
    external resource (comment ID, check run URL, etc.).
    """

    __relocation_scope__ = RelocationScope.Excluded

    iteration = FlexibleForeignKey(
        "seer.PullRequestIteration", on_delete=models.CASCADE, related_name="feedback"
    )
    type = models.CharField(max_length=64, choices=IterationFeedbackType.choices)
    ref = models.CharField(max_length=512)

    class Meta:
        app_label = "seer"
        db_table = "seer_iterationfeedback"

    __repr__ = sane_repr("iteration_id", "type", "ref")
