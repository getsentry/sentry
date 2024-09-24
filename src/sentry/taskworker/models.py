from datetime import datetime
from typing import Any, Self
from uuid import uuid4

import orjson
from django.db import models
from django.utils import timezone
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.sentry.v1alpha.taskworker_pb2 import (
    TASK_ACTIVATION_STATUS_COMPLETE,
    TASK_ACTIVATION_STATUS_FAILURE,
    TASK_ACTIVATION_STATUS_PROCESSING,
    TASK_ACTIVATION_STATUS_RETRY,
    InflightActivation,
    RetryState,
    TaskActivation,
    TaskActivationStatus,
)

from sentry.backup.scopes import RelocationScope
from sentry.db.models import JSONField, Model


class InflightActivationModel(Model):
    """
    The InflightActivation gives us a durable place to track progress within a batch,
    reduce duplicate task execution and be able to manage batch timeouts, worker death,
    and unprocessable messages

    While this is implemented with django/postgres right now we're early in the prototyping
    for taskworker and this will likely change.
    """

    __relocation_scope__ = RelocationScope.Excluded

    class States(models.TextChoices):
        PENDING = "pending"
        PROCESSING = "processing"
        COMPLETE = "complete"
        FAILURE = "failure"
        RETRY = "retry"

    # TaskActivation attributes
    id = models.UUIDField()
    taskname = models.CharField(max_length=255, null=True)
    namespace = models.CharField(max_length=255, null=True)
    parameters: models.Field[dict[str, Any] | None, dict[str, Any] | None] = JSONField(null=True)
    headers: models.Field[dict[str, Any] | None, dict[str, Any] | None] = JSONField(null=True)
    received_at = models.DateTimeField()
    deadline = models.DateTimeField(null=True)

    # Retry state fields
    retry_attempts = models.IntegerField(default=0)
    retry_kind = models.CharField(max_length=255, null=True, blank=True)
    deadletter_after_attempt = models.IntegerField(null=True, blank=True)
    discard_after_attempt = models.IntegerField(null=True, blank=True)

    # InflightActivation fields
    status = models.CharField(choices=States.choices)
    offset = models.IntegerField()
    # Timestamp taskactivation was added to inflight activations
    added_at = models.DateTimeField(default=timezone.now, blank=True)
    deadletter_at = models.DateTimeField(blank=True, null=True)
    processing_deadline = models.DateTimeField(blank=True, null=True)

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
            kind=self.retry_kind or "",
        )

    @classmethod
    def from_proto(cls, inflight: InflightActivation) -> Self:
        # TODO(mark) Remove partition and topic from the pending task storage.
        return cls(
            id=inflight.activation.id,
            namespace=inflight.activation.namespace,
            taskname=inflight.activation.taskname,
            parameters=orjson.loads(inflight.activation.parameters),
            headers=orjson.dumps(inflight.activation.headers),
            received_at=datetime.fromtimestamp(inflight.activation.received_at.seconds),
            # TODO implement deadlines
            deadline=None,
            retry_attempts=inflight.activation.retry_state.attempts,
            retry_kind=inflight.activation.retry_state.kind,
            deadletter_after_attempt=inflight.activation.retry_state.deadletter_after_attempt,
            discard_after_attempt=inflight.activation.retry_state.discard_after_attempt,
            status=cls.to_model_status(inflight.status),
            offset=inflight.offset,
            added_at=inflight.added_at,
            deadletter_at=inflight.deadletter_at,
            processing_deadline=(
                inflight.processing_deadline if inflight.processing_deadline else None
            ),
        )

    def to_proto(self) -> InflightActivation:
        """Convert a pendingtask record into a topic message"""
        data = InflightActivation(
            activation=TaskActivation(
                id=uuid4().hex,
                namespace=self.namespace,
                taskname=self.taskname,
                parameters=orjson.dumps(self.parameters) if self.parameters else None,
                retry_state=RetryState(
                    attempts=self.retry_attempts,
                    kind=self.retry_kind or "",
                    discard_after_attempt=self.discard_after_attempt,
                    deadletter_after_attempt=self.deadletter_after_attempt,
                ),
            ),
            status=self.to_proto_status(self.status),
            offset=self.offset,
            added_at=Timestamp(seconds=self.added_at.timestamp()),
            processing_deadline=Timestamp(seconds=self.processing_deadline.timestamp()),
        )
        return data

    @classmethod
    def to_model_status(cls, status: TaskActivationStatus.ValueType) -> States:
        return [
            cls.States.PENDING,
            cls.States.PROCESSING,
            cls.States.COMPLETE,
            cls.States.FAILURE,
            cls.States.RETRY,
        ][status]

    @classmethod
    def to_proto_status(cls, status: States) -> TaskActivationStatus.ValueType:
        return {
            "processing": TASK_ACTIVATION_STATUS_PROCESSING,
            "complete": TASK_ACTIVATION_STATUS_COMPLETE,
            "failure": TASK_ACTIVATION_STATUS_FAILURE,
            "retry": TASK_ACTIVATION_STATUS_RETRY,
        }[status]
