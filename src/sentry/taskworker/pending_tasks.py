from dataclasses import dataclass
from enum import Enum

from sentry_protos.hackweek_team_no_celery_pls.v1alpha.pending_task_pb2 import (
    PendingTask as PendingTaskProto,
)


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
