from datetime import datetime

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model


class PendingTasks(Model):
    """
    The PendingTaskStore gives us a durable place to track progress within a batch,
    reduce duplicate task execution and be able to manage batch timeouts, worker death,
    and unprocessable messages
    """

    class States(models.TextChoices):
        PENDING = "pending"
        PROCESSING = "processing"
        COMPLETE = "complete"
        FAILURE = "failure"
        RETRY = "retry"

    __relocation_scope__ = RelocationScope.Excluded

    id = (models.UUIDField(),)
    # Could be omitted if pending tasks are stored in redis, or kafka.
    topic = (models.CharField(blank=True, null=True),)
    # Could be omitted if pending tasks are stored in redis, or kafka.
    partition = models.IntegerField(default=2, blank=True, null=True)
    offset = models.IntegerField(blank=True, null=True)
    state = models.CharField(choices=States.choices)
    received_at = models.DateTimeField()
    added_at = models.DateTimeField(default=datetime.now, blank=True)
    retry_state = models.CharField(choices=States.choices)
    deadletter_at = models.DateTimeField()
    processing_deadline = models.DateTimeField()
