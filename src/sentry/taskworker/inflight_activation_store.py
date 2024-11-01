from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from collections.abc import Sequence
from datetime import datetime

from django.db import models
from sentry_protos.sentry.v1.taskworker_pb2 import InflightActivation, TaskActivationStatus

logger = logging.getLogger("sentry.taskworker.consumer")


class InflightTaskStore(ABC):
    @abstractmethod
    def store(self, batch: Sequence[InflightActivation]) -> None: ...

    @abstractmethod
    def get_pending_task(self) -> InflightActivation | None: ...

    @abstractmethod
    def count_pending_task(self) -> int: ...

    @abstractmethod
    def set_task_status(self, task_id: str, task_status: TaskActivationStatus.ValueType): ...

    @abstractmethod
    def set_task_deadline(self, task_id: str, task_deadline: datetime | None): ...

    @abstractmethod
    def delete_task(self, task_id: str): ...

    @abstractmethod
    def handle_retry_state_tasks(self) -> None: ...

    @abstractmethod
    def handle_deadletter_at(self) -> None: ...

    @abstractmethod
    def handle_processing_deadlines(self) -> None: ...

    @abstractmethod
    def handle_failed_tasks(self) -> None: ...

    @abstractmethod
    def remove_completed(self) -> None: ...


CREATE_TABLE_SQL = """
CREATE TABLE inflight_taskactivations (
    id UUID NOT NULL PRIMARY KEY,
    activation TEXT NOT NULL,
    offset BIGINTEGER NOT NULL,
    added_at DATETIME NOT NULL,
    deadletter_at DATETIME,
    processing_deadline DATETIME,
    status VARCHAR NOT NULL
);
"""


class Status(models.TextChoices):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETE = "complete"
    FAILURE = "failure"
    RETRY = "retry"


class InflightTaskStoreSqlite(InflightTaskStore):
    def __init__(self):
        pass

    def store(self, batch: Sequence[InflightActivation]) -> None:
        pass

    def get_pending_task(self) -> InflightActivation | None:
        return None

    def count_pending_task(self) -> int:
        return 0

    def set_task_status(self, task_id: str, task_status: TaskActivationStatus.ValueType) -> None:
        pass

    def set_task_deadline(self, task_id: str, task_deadline: datetime | None) -> None:
        pass

    def delete_task(self, task_id: str) -> None:
        pass

    def handle_retry_state_tasks(self) -> None:
        pass

    def handle_deadletter_at(self) -> None:
        pass

    def handle_processing_deadlines(self) -> None:
        pass

    def handle_failed_tasks(self) -> None:
        pass

    def remove_completed(self) -> None:
        pass
