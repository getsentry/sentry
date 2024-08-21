import time
from datetime import datetime
from typing import Any
from uuid import uuid4

from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import JSONField, Model
from sentry.taskworker.retry import RetryState


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
    topic = models.CharField(blank=True, null=True)
    task_name = models.CharField(max_length=255, null=True)
    parameters: models.Field[dict[str, Any] | None, dict[str, Any] | None] = JSONField(null=True)
    # Could be omitted if pending tasks are stored in redis, or kafka.
    task_namespace = models.CharField(max_length=255, null=True)
    partition = models.IntegerField(blank=True, null=True)
    offset = models.IntegerField(blank=True, null=True)
    state = models.CharField(choices=States.choices)
    received_at = models.DateTimeField()
    added_at = models.DateTimeField(default=timezone.now, blank=True)

    # Retry state fields
    headers: models.Field[dict[str, Any] | None, dict[str, Any] | None] = JSONField(null=True)
    retry_attempts: int = models.IntegerField(default=0)
    retry_kind: str = models.CharField(max_length=255, null=True, blank=True)
    deadletter_after_attempt: int = models.IntegerField(null=True, blank=True)
    discard_after_attempt: int = models.IntegerField(null=True, blank=True)
    deadletter_at: datetime = models.DateTimeField()
    processing_deadline: datetime = models.DateTimeField(blank=True, null=True)

    def has_retries_remaining(self) -> bool:
        if (
            self.deadletter_after_attempt is not None
            and self.retry_attempts < self.deadletter_after_attempt
        ):
            return True
        if (
            self.discard_after_attempt is not None
            and self.retry_attempts < self.discard_after_attempt
        ):
            return True
        return False

    def retry_state(self) -> RetryState:
        return RetryState(
            attempts=self.retry_attempts,
            discard_after_attempt=self.discard_after_attempt,
            deadletter_after_attempt=self.deadletter_after_attempt,
            kind=self.retry_kind,
        )

    def to_message(self):
        """Convert a pendingtask record into a topic message"""
        data = {
            "id": uuid4().hex,
            "namespace": self.task_namespace,
            "taskname": self.task_name,
            "parameters": self.parameters,
            "received_at": time.time(),
            "headers": self.headers,
            "retry_state": self.retry_state().to_dict(),
            "deadline": self.processing_deadline,
        }
        return data
