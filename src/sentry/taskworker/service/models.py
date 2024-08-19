from datetime import datetime

from sentry.hybridcloud.rpc import RpcModel
from sentry.taskworker.models import PendingTasks


class RpcTask(RpcModel):
    id: int
    topic: str
    partition: int
    offset: int
    state: PendingTasks.States
    received_at: datetime
    added_at: datetime
    deadletter_at: datetime
    processing_deadline: datetime


def serialize_task(pending_task: PendingTasks) -> RpcTask:
    return RpcTask(
        id=PendingTasks.id,
        topic=PendingTasks.topic,
        partition=PendingTasks.partition,
        offset=PendingTasks.offset,
        state=PendingTasks.state,
        received_at=pending_task.received_at,
        added_at=pending_task.added_at,
        deadletter_at=pending_task.deadletter_at,
        processing_deadline=pending_task.processing_deadline,
    )
