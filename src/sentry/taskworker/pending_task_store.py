import logging
import sqlite3
from collections.abc import Sequence
from contextlib import contextmanager
from datetime import datetime, timedelta
from uuid import uuid4

from django.conf import settings
from django.db import models, router, transaction
from django.db.models import Max
from django.utils import timezone
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.sentry.v1alpha.taskworker_pb2 import (
    TASK_ACTIVATION_STATUS_COMPLETE,
    TASK_ACTIVATION_STATUS_FAILURE,
    TASK_ACTIVATION_STATUS_PENDING,
    TASK_ACTIVATION_STATUS_PROCESSING,
    TASK_ACTIVATION_STATUS_RETRY,
    InflightActivation,
    TaskActivation,
    TaskActivationStatus,
)

from sentry.utils.dates import parse_timestamp

logger = logging.getLogger("sentry.taskworker.consumer")


class PendingTaskStore:
    def __init__(self):
        self.do_imports()

    def do_imports(self) -> None:
        for module in settings.TASKWORKER_IMPORTS:
            __import__(module)

    def store(self, batch: Sequence[InflightActivation]):
        # Takes in a batch of pending tasks and stores them in some datastore
        from sentry.taskworker.models import InflightActivationModel

        InflightActivationModel.objects.bulk_create(
            [InflightActivationModel.from_proto(task) for task in batch],
            ignore_conflicts=True,
        )

    def get_pending_task(self) -> InflightActivation | None:
        from sentry.taskworker.models import InflightActivationModel

        with transaction.atomic(using=router.db_for_write(InflightActivationModel)):
            query_set = InflightActivationModel.objects.select_for_update().filter(
                status=InflightActivationModel.Status.PENDING
            )
            task = query_set.first()
            if task is None:
                return None

            # TODO this duration should be a tasknamespace setting, or with an option
            deadline = datetime.now() + timedelta(seconds=30)

            task.update(
                status=InflightActivationModel.Status.PROCESSING, processing_deadline=deadline
            )
            return task.to_proto()

    def count_pending_task(self) -> int:
        from django.db import router, transaction

        from sentry.taskworker.models import InflightActivationModel

        with transaction.atomic(using=router.db_for_write(InflightActivationModel)):
            query_set = InflightActivationModel.objects.filter(
                status=InflightActivationModel.Status.PENDING
            )
            return query_set.count()

    def set_task_status(self, task_id: str, task_status: TaskActivationStatus.ValueType):
        from sentry.taskworker.models import InflightActivationModel

        task_status = InflightActivationModel.to_model_status(task_status)

        with transaction.atomic(using=router.db_for_write(InflightActivationModel)):
            # Pull a select for update here to lock the row while we mutate the retry count
            task = InflightActivationModel.objects.select_for_update().filter(id=task_id).get()

            task.update(status=task_status)
            if task_status == InflightActivationModel.Status.RETRY:
                task.update(retry_attempts=task.retry_attempts + 1)

    def set_task_deadline(self, task_id: str, task_deadline: datetime | None):
        from sentry.taskworker.models import InflightActivationModel

        with transaction.atomic(using=router.db_for_write(InflightActivationModel)):
            # Pull a select for update here to lock the row while we mutate the retry count
            task = InflightActivationModel.objects.select_for_update().filter(id=task_id).get()
            task.update(deadline=task_deadline)

    def delete_task(self, task_id: str):
        from sentry.taskworker.models import InflightActivationModel

        with transaction.atomic(using=router.db_for_write(InflightActivationModel)):
            task = InflightActivationModel.objects.select_for_update().filter(id=task_id).get()
            task.delete()

    def handle_retry_state_tasks(self) -> None:
        from sentry.taskworker.config import taskregistry
        from sentry.taskworker.models import InflightActivationModel

        with transaction.atomic(using=router.db_for_write(InflightActivationModel)):
            retry_qs = InflightActivationModel.objects.filter(
                status=InflightActivationModel.Status.RETRY
            )
            for item in retry_qs:
                task_ns = taskregistry.get(item.namespace)
                task_proto = item.to_proto()
                task_proto.activation.id = uuid4().hex
                task_ns.retry_task(task_proto.activation)

            # With retries scheduled, the tasks are complete now.
            retry_qs.update(status=InflightActivationModel.Status.COMPLETE)

    def handle_deadletter_at(self) -> None:
        from sentry.taskworker.models import InflightActivationModel

        with transaction.atomic(using=router.db_for_write(InflightActivationModel)):
            # Require a completed task with a higher offset to be present
            max_completed_id = (
                InflightActivationModel.objects.filter(
                    status=InflightActivationModel.Status.COMPLETE
                ).aggregate(max_offset=Max("offset"))["max_offset"]
                or 0
            )
            expired_qs = InflightActivationModel.objects.filter(
                deadletter_at__lt=timezone.now(),
                offset__lt=max_completed_id,
                status=InflightActivationModel.Status.PENDING,
            )
            # Messages that are still pending and exceeded their deadletter_at are failures
            updated = expired_qs.update(status=InflightActivationModel.Status.FAILURE)
        if updated:
            logger.info("task.deadletter_at", extra={"count": updated})

    def handle_processing_deadlines(self) -> None:
        from sentry.taskworker.models import InflightActivationModel

        with transaction.atomic(using=router.db_for_write(InflightActivationModel)):
            past_deadline = InflightActivationModel.objects.filter(
                processing_deadline__lt=timezone.now(),
            ).exclude(status=InflightActivationModel.Status.COMPLETE)
            to_update = []
            for item in past_deadline:
                if item.has_retries_remaining():
                    to_update.append(item.id)

            # Move processing deadline tasks back to pending
            InflightActivationModel.objects.filter(id__in=to_update).update(
                status=InflightActivationModel.Status.PENDING,
                processing_deadline=None,
            )
        if len(to_update):
            logger.info("task.processingdeadline", extra={"count": len(to_update)})

    def handle_failed_tasks(self) -> None:
        from sentry.taskworker.models import InflightActivationModel

        with transaction.atomic(using=router.db_for_write(InflightActivationModel)):
            failed = InflightActivationModel.objects.filter(
                status=InflightActivationModel.Status.FAILURE
            )
            to_discard = []
            to_deadletter = []
            for item in failed:
                if item.discard_after_attempt is not None:
                    to_discard.append(item.id)
                if item.deadletter_after_attempt is not None:
                    to_deadletter.append(item.id)

            # Discard messages are simply acked and never processed again
            InflightActivationModel.objects.filter(id__in=to_discard).update(
                status=InflightActivationModel.Status.COMPLETE
            )
            # TODO do deadletter delivery
            InflightActivationModel.objects.filter(id__in=to_deadletter).update(
                status=InflightActivationModel.Status.COMPLETE
            )

        if len(to_discard):
            logger.info("task.failed.discarded", extra={"count": len(to_discard)})
        if len(to_deadletter):
            logger.info("task.failed.deadletter", extra={"count": len(to_deadletter)})

    def remove_completed(self) -> None:
        from sentry.taskworker.models import InflightActivationModel

        with transaction.atomic(using=router.db_for_write(InflightActivationModel)):
            lowest_incomplete = (
                InflightActivationModel.objects.exclude(
                    status=InflightActivationModel.Status.COMPLETE,
                )
                .order_by("-offset")
                .values_list("offset", flat=True)
                .first()
            )
            if not lowest_incomplete:
                return

            # Only remove completed records that have lower offsets than the lowest
            # incomplete offset. We don't want to remove completed tasks that have
            # incomplete tasks with lower offsets as it can lead to dataloss due to worker
            # exhaustion.
            query = InflightActivationModel.objects.filter(
                status=InflightActivationModel.Status.COMPLETE,
                offset__lt=lowest_incomplete,
            )
            query.delete()


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


class InflightTaskStoreSqlite:
    def __init__(self, db_shard: str):
        self.__db_shard = db_shard
        self.ensure_schema()

    @contextmanager
    def connection(self):
        connection = sqlite3.connect(f"./taskworker-storage-{self.__db_shard}.sqlite")
        connection.row_factory = sqlite3.Row
        try:
            yield connection
        finally:
            connection.close()

    def ensure_schema(self):
        with self.connection() as connection:
            cursor = connection.execute("PRAGMA table_info(inflight_taskactivations)")
            res = cursor.fetchone()
            if res:
                return
            connection.execute(CREATE_TABLE_SQL)

    def store(self, batch: Sequence[InflightActivation]):
        # Takes in a batch of pending tasks and stores them in some datastore
        with self.connection() as connection:
            rows = []
            for item in batch:
                deadletter_at = (
                    datetime.fromtimestamp(item.deadletter_at.seconds)
                    if item.deadletter_at
                    else None
                )
                row = (
                    item.activation.id,
                    item.activation.SerializeToString(),
                    item.offset,
                    datetime.fromtimestamp(item.added_at.seconds),
                    deadletter_at,
                    # TODO use a map method.
                    Status.PENDING,
                )
                rows.append(row)
            connection.executemany(
                """
                INSERT INTO inflight_taskactivations
                (id, activation, offset, added_at, deadletter_at, status)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO NOTHING
                """,
                rows,
            )
            connection.commit()

    def get_pending_task(self) -> InflightActivation | None:
        # Get a single pending task from the store.
        with self.connection() as connection:
            cursor = connection.execute(
                "SELECT id FROM inflight_taskactivations WHERE status = ? LIMIT 1",
                (Status.PENDING,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            # TODO this duration should be a tasknamespace setting, or with an option
            deadline = datetime.now() + timedelta(seconds=30)

            connection.execute(
                "UPDATE inflight_taskactivations SET status = ?, processing_deadline = ? WHERE id = ?",
                (Status.PROCESSING, deadline.isoformat(), row["id"]),
            )
            connection.commit()

            cursor = connection.execute(
                "SELECT * FROM inflight_taskactivations WHERE id = ?", (row["id"],)
            )
            return self._row_to_proto(cursor.fetchone())

    def _status_to_proto(self, status: str) -> TaskActivationStatus.ValueType:
        return {
            "pending": TASK_ACTIVATION_STATUS_PENDING,
            "processing": TASK_ACTIVATION_STATUS_PROCESSING,
            "complete": TASK_ACTIVATION_STATUS_COMPLETE,
            "failure": TASK_ACTIVATION_STATUS_FAILURE,
            "retry": TASK_ACTIVATION_STATUS_RETRY,
        }[status]

    def _status_to_model(self, status: TaskActivationStatus.ValueType) -> Status:
        return {
            TASK_ACTIVATION_STATUS_PENDING: Status.PENDING,
            TASK_ACTIVATION_STATUS_PROCESSING: Status.PROCESSING,
            TASK_ACTIVATION_STATUS_COMPLETE: Status.COMPLETE,
            TASK_ACTIVATION_STATUS_FAILURE: Status.FAILURE,
            TASK_ACTIVATION_STATUS_RETRY: Status.RETRY,
        }[status]

    def _row_to_proto(self, row: sqlite3.Row) -> InflightActivation:
        activation = TaskActivation()
        activation.ParseFromString(row["activation"])

        added_at = parse_timestamp(row["added_at"])
        assert added_at

        processing_deadline = None
        parsed_deadline = parse_timestamp(row["processing_deadline"])
        if parsed_deadline:
            processing_deadline = Timestamp(seconds=int(parsed_deadline.timestamp()))

        data = InflightActivation(
            activation=activation,
            status=self._status_to_proto(row["status"]),
            offset=row["offset"],
            added_at=Timestamp(seconds=int(added_at.timestamp())),
            processing_deadline=processing_deadline,
        )
        return data

    def count_pending_task(self) -> int:
        # Get the count of tasks with status=pending
        with self.connection() as connection:
            cursor = connection.execute(
                "SELECT COUNT(*) FROM inflight_taskactivations WHERE status = ?", (Status.PENDING,)
            )
            return cursor.fetchone()[0]

    def set_task_status(self, task_id: str, task_status: TaskActivationStatus.ValueType):
        # Update the status for a task
        model_status = self._status_to_model(task_status)
        with self.connection() as connection:
            cursor = connection.execute(
                "SELECT * FROM inflight_taskactivations WHERE id = ?", (task_id,)
            )
            row = cursor.fetchone()
            if not row:
                raise ValueError(f"Invalid taskid of {task_id}")

            # TODO do retry state update?
            connection.execute(
                "UPDATE inflight_taskactivations SET status = ? WHERE id = ?",
                (model_status, task_id),
            )
            connection.commit()

    def set_task_deadline(self, task_id: str, task_deadline: datetime | None):
        # Set the deadline for a task
        with self.connection() as connection:
            cursor = connection.execute(
                "SELECT * FROM inflight_taskactivations WHERE id = ?", (task_id,)
            )
            row = cursor.fetchone()
            if not row:
                raise ValueError(f"Invalid taskid of {task_id}")
            deadline = None
            if task_deadline:
                deadline = task_deadline.isoformat()

            connection.execute(
                "UPDATE inflight_taskactivations SET deadline = ? WHERE id = ?", (deadline, task_id)
            )
            connection.commit()

    def delete_task(self, task_id: str):
        # Delete a task from the store
        with self.connection() as connection:
            connection.execute("DELETE FROM inflight_taskactivations WHERE id = ?", (task_id,))

    def handle_retry_state_tasks(self) -> None:
        # Move tasks with status=retry into new tasks and update status.
        from sentry.taskworker.config import taskregistry

        with self.connection() as connection:
            cursor = connection.execute(
                "SELECT * FROM inflight_taskactivations WHERE status = ?", (Status.RETRY,)
            )
            ids = []
            for item in cursor.fetchall():
                activation = TaskActivation()
                activation.ParseFromString(item["activation"])
                activation.id = uuid4().hex
                activation.retry_state.attempts += 1

                task_ns = taskregistry.get(activation.namespace)
                task_ns.retry_task(activation)
                ids.append(item["id"])
            cursor.close()

            placeholders = ",".join(["?"] * len(ids))
            connection.execute(
                f"UPDATE inflight_taskactivations SET status = ? WHERE id IN ({placeholders})",
                (Status.COMPLETE, *ids),
            )
            connection.commit()

    def handle_deadletter_at(self) -> None:
        # Do upkeep work related to expired deadletter_at values
        with self.connection() as connection:
            max_complete_cursor = connection.execute(
                """SELECT MAX("offset") AS max_offset FROM inflight_taskactivations WHERE status = ?""",
                (Status.COMPLETE,),
            )
            max_complete_offset = max_complete_cursor.fetchone()["max_offset"]
            max_complete_cursor.close()

            expired_cursor = connection.execute(
                """
                UPDATE inflight_taskactivations
                SET status= ?
                WHERE deadletter_at < ? AND "offset" < ? AND status = ?
                """,
                (Status.FAILURE, timezone.now(), max_complete_offset, Status.PENDING),
            )
            updated = expired_cursor.rowcount
            connection.commit()
        if updated:
            logger.info("task.deadletter_at", extra={"count": updated})

    def handle_processing_deadlines(self) -> None:
        # Do upkeep work related to expired processing_deadlines
        with self.connection() as connection:
            past_deadline_cursor = connection.execute(
                """
                SELECT id, activation
                FROM inflight_taskactivations
                WHERE processing_deadline < ?
                AND status != ?
                """,
                (
                    timezone.now(),
                    Status.COMPLETE,
                ),
            )
            to_update = []
            for row in past_deadline_cursor.fetchall():
                activation = TaskActivation()
                activation.ParseFromString(row["activation"])

                retry_state = activation.retry_state

                has_retries_remaining = False
                if (
                    retry_state.deadletter_after_attempt is not None
                    and retry_state.attempts < retry_state.deadletter_after_attempt
                ):
                    has_retries_remaining = True
                if (
                    retry_state.discard_after_attempt is not None
                    and retry_state.attempts < retry_state.discard_after_attempt
                ):
                    has_retries_remaining = True
                if has_retries_remaining:
                    to_update.append(row["id"])

            placeholders = ",".join(["?"] * len(to_update))
            cursor = connection.execute(
                f"""
                UPDATE inflight_taskactivations
                SET status = ?, processing_deadline = null
                WHERE id IN ({placeholders})
                """,
                (Status.PENDING, *to_update),
            )
            connection.commit()
            if cursor.rowcount:
                logger.info("task.processingdeadline", extra={"count": cursor.rowcount})

    def handle_failed_tasks(self) -> None:
        # Do upkeep work related to status=failed tasks
        with self.connection() as connection:
            failed_cursor = connection.execute(
                """
                SELECT id, activation
                FROM inflight_taskactivations
                WHERE status = ?
                """,
                (Status.FAILURE,),
            )
            to_discard = []
            to_deadletter = []
            for row in failed_cursor.fetchall():
                activation = TaskActivation()
                activation.ParseFromString(row["activation"])
                retry_state = activation.retry_state
                if retry_state.discard_after_attempt is not None:
                    to_discard.append(row["id"])
                if retry_state.deadletter_after_attempt is not None:
                    to_deadletter.append(row["id"])
            failed_cursor.close()

            if to_discard:
                placeholders = ",".join(["?"] * len(to_discard))
                connection.execute(
                    f"""
                    UPDATE inflight_taskactivations SET status = ? WHERE id IN ({placeholders})
                    """,
                    (Status.COMPLETE, *to_discard),
                )

            # TODO do deadletter delivery
            if to_deadletter:
                placeholders = ",".join(["?"] * len(to_deadletter))
                connection.execute(
                    f"""
                    UPDATE inflight_taskactivations SET status = ? WHERE id IN ({placeholders})
                    """,
                    (Status.COMPLETE, *to_deadletter),
                )
            connection.commit()

    def remove_completed(self) -> None:
        # Do upkeep work related to status=completed tasks
        with self.connection() as connection:
            lowest_cursor = connection.execute(
                """
                SELECT "offset"
                FROM inflight_taskactivations
                WHERE status != ?
                ORDER BY "offset"
                LIMIT 1
                """,
                (Status.COMPLETE,),
            )
            lowest_offset = lowest_cursor.fetchone()
            if not lowest_offset:
                return
            connection.execute(
                """
                DELETE FROM inflight_taskactivations
                WHERE status = ? AND "offset" < ?
                """,
                (Status.COMPLETE, lowest_offset["offset"]),
            )
            connection.commit()
