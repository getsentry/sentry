from datetime import datetime
from typing import Any

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import JSONField, Model


class PendingTasks(Model):
    """
    The PendingTaskStore gives us a durable place to track progress within a batch,
    reduce duplicate task execution and be able to manage batch timeouts, worker death,
    and unprocessable messages
    """

    __relocation_scope__ = RelocationScope.Excluded

    class States(models.TextChoices):
        PENDING = "pending"
        PROCESSING = "processing"
        COMPLETE = "complete"
        FAILURE = "failure"
        RETRY = "retry"

    # Could be omitted if pending tasks are stored in redis, or kafka.
    topic: str = models.CharField(blank=True, null=True)
    task_name: str = models.CharField(max_length=255, null=True)
    parameters: models.Field[dict[str, Any] | None, dict[str, Any] | None] = JSONField(null=True)
    # Could be omitted if pending tasks are stored in redis, or kafka.
    task_namespace: str = models.CharField(max_length=255, null=True)
    partition: int = models.IntegerField(blank=True, null=True)
    offset: int = models.IntegerField(blank=True, null=True)
    state: States = models.CharField(choices=States.choices)
    received_at: datetime = models.DateTimeField()
    added_at: datetime = models.DateTimeField(default=datetime.now, blank=True)
    retry_state: models.Field[dict[str, Any]] = JSONField(null=True)
    deadletter_at: datetime = models.DateTimeField()
    processing_deadline: datetime = models.DateTimeField(blank=True, null=True)
