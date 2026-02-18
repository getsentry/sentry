from __future__ import annotations

from enum import StrEnum

from django.db import models
from django.db.models.functions import Now

from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedBigIntegerField, Model, region_silo_model, sane_repr


class CodeReviewRunStatus(StrEnum):
    TASK_ENQUEUED = "task_enqueued"
    SEER_REQUEST_SENT = "seer_request_sent"
    SEER_REQUEST_SUCCEEDED = "seer_request_succeeded"
    SEER_REQUEST_FAILED = "seer_request_failed"

    @classmethod
    def as_choices(cls) -> tuple[tuple[str, str], ...]:
        return tuple((s.value, s.value) for s in cls)


@region_silo_model
class CodeReviewRun(Model):
    """
    Tracks individual code review runs triggered by GitHub webhook events.

    Created when a task is enqueued and updated as it progresses through
    the pipeline (task enqueued -> Seer request sent -> Seer response received).
    Records are retained for 90 days and cleaned up by a periodic task.
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization_id = BoundedBigIntegerField(db_index=True)
    repository_id = BoundedBigIntegerField(db_index=True)
    pull_request_number = models.IntegerField()
    commit_sha = models.CharField(max_length=64)
    github_delivery_id = models.CharField(max_length=64, db_index=True)
    status = models.CharField(
        max_length=32,
        choices=CodeReviewRunStatus.as_choices(),
        default=CodeReviewRunStatus.TASK_ENQUEUED,
    )
    seer_response_status = models.IntegerField(null=True)
    error_message = models.TextField(null=True)
    date_added = models.DateTimeField(db_default=Now(), db_index=True)
    date_updated = models.DateTimeField(db_default=Now(), auto_now=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_codereviewrun"

    __repr__ = sane_repr("organization_id", "repository_id", "pull_request_number", "status")
