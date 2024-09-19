from dataclasses import dataclass
from enum import Enum

from sentry_protos.hackweek_team_no_celery_pls.v1alpha.pending_task_pb2 import (
    PendingTask as PendingTaskProto,
)

from sentry.taskworker.retry import RetryState


class PendingTaskState(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETE = "complete"
    FAILURE = "failure"
    RETRY = "retry"


@dataclass
class PendingTask:
    proto_task: PendingTaskProto
    state: PendingTaskState
    topic: str
    partition: int
    offset: int
    id: int | None = None  # set by the datastore

    def retry_state(self) -> RetryState:
        return RetryState(
            attempts=self.proto_task.retry_state.attempts,
            discard_after_attempt=self.proto_task.retry_state.discard_after_attempt,
            deadletter_after_attempt=self.proto_task.retry_state.deadletter_after_attempt,
            kind=self.proto_task.retry_state.kind,
        )
