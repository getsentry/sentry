from datetime import datetime
from typing import Any

import orjson

from sentry.hybridcloud.rpc import RpcModel
from sentry.taskworker.models import PendingTasks


class RpcTask(RpcModel):
    id: int
    topic: str
    task_name: str
    parameters: dict[str, Any] | None
    partition: int
    offset: int
    state: PendingTasks.States
    received_at: datetime
    added_at: datetime
    deadletter_at: datetime
    processing_deadline: datetime


def serialize_task(pending_task: PendingTasks) -> RpcTask:
    params = orjson.loads(pending_task.parameters) if pending_task.parameters else None
    return RpcTask(
        id=pending_task.id,
        topic=pending_task.topic,
        partition=pending_task.partition,
        task_name=pending_task.task_name,
        parameters=params,
        offset=pending_task.offset,
        state=pending_task.state,
        received_at=pending_task.received_at,
        added_at=pending_task.added_at,
        deadletter_at=pending_task.deadletter_at,
        processing_deadline=pending_task.processing_deadline,
    )
