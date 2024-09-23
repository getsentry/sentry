from datetime import datetime
from typing import Any
from uuid import uuid4

import orjson
from django.db import models
from django.utils import timezone
from sentry_protos.hackweek_team_no_celery_pls.v1alpha.pending_task_pb2 import (
    COMPLETE,
    FAILURE,
    PROCESSING,
    RETRY,
)
from sentry_protos.hackweek_team_no_celery_pls.v1alpha.pending_task_pb2 import (
    RetryPolicy as RetryPolicyProto,
)
from sentry_protos.hackweek_team_no_celery_pls.v1alpha.pending_task_pb2 import Status, Task, Work

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

    @classmethod
    def from_proto(cls, task: Task) -> "PendingTasks":
        return cls(
            task_namespace=task.work.task_namespace,
            task_name=task.work.taskname,
            topic=task.topic,
            parameters=orjson.loads(task.work.parameters),
            partition=task.partition,
            state=cls.to_model_status(task.status),
            offset=task.offset,
            processing_deadline=(
                task.work.processing_deadline if task.work.processing_deadline else None
            ),
            retry_attempts=task.work.retry_state.attempts,
            retry_kind=task.work.retry_state.kind,
            deadletter_at=task.deadletter_at or timezone.now(),
            deadletter_after_attempt=task.work.retry_state.deadletter_after_attempt,
            discard_after_attempt=task.work.retry_state.discard_after_attempt,
            received_at=datetime.fromtimestamp(task.received_at),
        )

    def to_proto(self) -> Task:
        """Convert a pendingtask record into a topic message"""
        data = Task(
            work=Work(
                task_id=uuid4().hex,
                taskname=self.task_name,
                parameters=orjson.dumps(self.parameters) if self.parameters else None,
                task_namespace=self.task_namespace,
                processing_deadline=str(self.processing_deadline),
                retry_state=RetryPolicyProto(
                    attempts=self.retry_attempts,
                    kind=self.retry_kind,
                    discard_after_attempt=self.discard_after_attempt,
                    deadletter_after_attempt=self.deadletter_after_attempt,
                ),
            ),
            status=self.to_proto_status(self.state),
            topic=self.topic,
            partition=self.partition,
            offset=self.offset,
            received_at=int(self.received_at.timestamp()),
            store_id=self.id,
        )
        return data

    @classmethod
    def to_model_status(cls, status: Status.ValueType) -> States:
        return [
            cls.States.PENDING,
            cls.States.PROCESSING,
            cls.States.COMPLETE,
            cls.States.FAILURE,
            cls.States.RETRY,
        ][status]

    @classmethod
    def to_proto_status(cls, status: States) -> Status.ValueType:
        {
            "processing": PROCESSING,
            "complete": COMPLETE,
            "failure": FAILURE,
            "retry": RETRY,
        }[status]
