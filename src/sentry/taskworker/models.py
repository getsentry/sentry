import datetime
import inspect

from django.db import models

from sentry.db.models import Model


class State:
    PENDING = "pending"
    COMPLETE = "complete"
    FAILURE = "failure"
    RETRY = "retry"


class PendingTasks(Model):
    """
    The PendingTaskStore gives us a durable place to track progress within a batch,
    reduce duplicate task execution and be able to manage batch timeouts, worker death,
    and unprocessable messages
    """

    id = (models.UUIDField(),)
    # Could be omitted if pending tasks are stored in redis, or kafka.
    topic = (models.CharField(blank=True, null=True),)
    # Could be omitted if pending tasks are stored in redis, or kafka.
    partition = models.IntegerField(default=2, blank=True, null=True)
    offset = models.IntegerField(blank=True, null=True)
    state = models.CharField(choices=[(y, x) for x, y in inspect.getmembers(State)])
    received_at = models.DateTimeField()
    added_at = models.DateTimeField(default=datetime.now, blank=True)
    retry_state = models.CharField(choices=[(y, x) for x, y in inspect.getmembers(State)])
    deadletter_at = models.DateTimeField()
    processing_deadline = models.DateTimeField()
