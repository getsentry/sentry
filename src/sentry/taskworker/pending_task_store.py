from __future__ import annotations

import logging
import sqlite3
from abc import ABC, abstractmethod
from collections.abc import Sequence
from contextlib import contextmanager
from datetime import datetime, timedelta
from time import sleep
from uuid import uuid4

from django.conf import settings
from django.db import models, router, transaction
from django.db.models import Max
from django.utils import timezone
from google.protobuf.json_format import MessageToDict, MessageToJson, Parse, ParseDict
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.sentry.v1alpha.taskworker_pb2 import (
    TASK_ACTIVATION_STATUS_COMPLETE,
    TASK_ACTIVATION_STATUS_FAILURE,
    TASK_ACTIVATION_STATUS_PENDING,
    TASK_ACTIVATION_STATUS_PROCESSING,
    TASK_ACTIVATION_STATUS_RETRY,
    InflightActivation,
    RetryState,
    TaskActivation,
    TaskActivationStatus,
)

from sentry.utils import redis
from sentry.utils.dates import parse_timestamp
from sentry.utils.locking.backends.redis import RedisClusterLockBackend

logger = logging.getLogger("sentry.taskworker.consumer")


def get_storage_backend(name: str | None) -> InflightTaskStore:
    if name == "postgres" or name is None:
        return InflightTaskStorePostgres()
    if name == "sqlite":
        # TODO need a way to pass in the shard_id.
        return InflightTaskStoreSqlite("taskdemo-1")
    if name == "redis":
        return InflightTaskStoreRedis()
    raise ValueError(f"Invalid storage backend {name}")


class InflightTaskStore(ABC):
    @abstractmethod
    def store(self, batch: Sequence[InflightActivation]) -> None:
        ...

    @abstractmethod
    def get_pending_task(self) -> InflightActivation | None:
        ...

    @abstractmethod
    def count_pending_task(self) -> int:
        ...

    @abstractmethod
    def set_task_status(self, task_id: str, task_status: TaskActivationStatus.ValueType):
        ...

    @abstractmethod
    def set_task_deadline(self, task_id: str, task_deadline: datetime | None):
        ...

    @abstractmethod
    def delete_task(self, task_id: str):
        ...

    @abstractmethod
    def handle_retry_state_tasks(self) -> None:
        ...

    @abstractmethod
    def handle_deadletter_at(self) -> None:
        ...

    @abstractmethod
    def handle_processing_deadlines(self) -> None:
        ...

    @abstractmethod
    def handle_failed_tasks(self) -> None:
        ...

    @abstractmethod
    def remove_completed(self) -> None:
        ...


class InflightTaskStorePostgres(InflightTaskStore):
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


class InflightTaskStoreRedis(InflightTaskStore):
    class RedisLock:
        def __init__(self, client, namespace):
            self.backend = RedisClusterLockBackend(client)
            self.namespace = namespace

        def __enter__(self):
            while True:
                try:
                    self.backend.acquire(self.namespace, 10)
                    break
                except Exception:
                    sleep(0.01)
                    continue

        def __exit__(self, type, value, traceback):
            self.backend.release(self.namespace)

    """
    The InflightTaskStoreRedis is a Redis backed store for inflight task activations.
    All keys are namespaced under the "taskworker" namespace.
    Keys are further divided into 3 subspaces:
        1) inflight_activation:<task_id> - Contains a hash of all the fields of a inflight activation
        2) inflight_activation:task:<task_id> - Contains the serialized task activation (JSON)
        3) inflight_activations:<task_id> - Contains a sorted set of task_ids ordered by their offsets


    Example 1):
    ------------------------------------------------------------------------
    # Set InflightActivation attributes in hash
    > HMSET inflight-activations:7bab0860-8526-4548-867a-a83241f160fb status "pending" offset "5" added_at "1728483460"
    deadletter_at "1728485600" processing_deadline "1728484100"
    (integer) 5

    # Get all attributes of InflightActivation hash given a task_id
    > HGETALL inflight-activations:7bab0860-8526-4548-867a-a83241f160fb
    {'status': '1', 'offset': '230', 'addedAt': '2024-10-10T15:29:07Z', 'deadletterAt': '2024-10-10T15:39:07Z'}
    ------------------------------------------------------------------------

    Example 2):
    ------------------------------------------------------------------------
    # Set serialized TaskActivation protobuf in a key
    > SET inflight-activation:{status}7bab0860-8526-4548-867a-a83241f160fb "{\"id\":\"86744761837344e4a2ddb7c202be3d0a\",\"namespace\":\"demos\",
    \"taskname\":\"demos.say_hello\",\"parameters\":\"{\\\"args\\\":[\\\"new task\\\"],\\\"kwargs\\\":{}}\",
    \"receivedAt\":\"2024-10-10T14:45:03Z\",\"retryState\":{\"attempts\":\"0\",\"kind\":\"sentry.taskworker.retry.Retry\",
    \"discardAfterAttempt\":\"0\",\"deadletterAfterAttempt\":\"3\"}}"

    # Get serialized TaskActivation protobuf given its task_id
    > GET inflight-activation:{status}:7bab0860-8526-4548-867a-a83241f160fb
    "{
    "id": "86744761837344e4a2ddb7c202be3d0a",
    "namespace": "demos",
    "taskname": "demos.say_hello",
    "parameters": "{\"args\":[\"new task\"],\"kwargs\":{}}",
    "receivedAt": "2024-10-10T14:45:03Z",
    "retryState": {
        "attempts": "0"
        "kind": "sentry.taskworker.retry.Retry",
        "discardAfterAttempt": "0",
        "deadletterAfterAttempt": "3"
    }
    }"
    ------------------------------------------------------------------------

    Example 3):
    ------------------------------------------------------------------------
    # Set a task_id and its offset in sorted set
    > ZADD taskworker:inflight-activations:1 12 "task2" 11 "task1" 13 "task3"

    # Get tasks sorted by their offsets given a status
    > ZRANGE inflight-activations:1 0 -1
    1) "task1"
    2) "task2"
    3) "task3"
    ------------------------------------------------------------------------

    Pros:
    - Constant time read operations for getting the task_id with the earliest or latest offset
    - TasksActivations are serialized as JSON to reduce the number of keys stored in Redis
    Cons:
    - Updating or filtering by attributes in the TasksActivations (e.g. retry state, namespace) requires deserializing and re-serializing the JSON
    - Deletion of an inflight activation requires multiple keys or hashes to be deleted
    - Many filtering queries requires loading all tasks of a certain status into memory

    Next steps:
    - Performance benchmark the store and iterate on key design based on results
    - Namespace by topic and parition
    - Operations are not atomic. If the consumer dies, it could lead to either stale data or data loss.
    """

    def __init__(self):
        self.do_imports()
        self.client = redis.redis_clusters.get("default")  # set to default for now
        self.namespace = "taskworker"
        self.redis_lock_namespace = f"{self.namespace}:inflight_activation"

    def do_imports(self) -> None:
        for module in settings.TASKWORKER_IMPORTS:
            __import__(module)

    def _build_inflight_activation_key(self, task_id: str) -> str:
        prefix = f"{self.namespace}:inflight_activation"
        return f"{prefix}:{task_id}"

    def _build_inflight_activations_key(self, status: str) -> str:
        prefix = f"{self.namespace}:inflight_activations"
        return f"{prefix}:{status}"

    def _build_task_key(self, task_id: str) -> str:
        prefix = f"{self.namespace}:inflight_activation:task"
        return f"{prefix}:{task_id}"

    def _set_task(self, task_id: str, task_json: str) -> None:
        key = self._build_task_key(task_id)
        self.client.set(key, task_json)

    def _set_inflight_activation_attributes(
        self, task_id: str, inflight_dict: dict[str, str]
    ) -> None:
        key = self._build_inflight_activation_key(task_id)
        self.client.hmset(key, inflight_dict)

    def _set_inflight_activations(self, status: int, offset: int, task_id: str) -> None:
        key = self._build_inflight_activations_key(status)
        self.client.zadd(key, {task_id: offset})

    def _get_task(self, task_id: str) -> str | None:
        key = self._build_task_key(task_id)
        return self.client.get(key)

    def _get_inflight_activation_field(self, task_id: str, field: str) -> str | None:
        key = self._build_inflight_activation_key(task_id)
        return self.client.hget(key, field)

    def _get_all_inflight_activation_fields(self, task_id: str) -> dict[str, str]:
        key = self._build_inflight_activation_key(task_id)
        return self.client.hgetall(key)

    def _get_min_offset_activation(self, status: int) -> str | None:
        status_key = self._build_inflight_activations_key(status)
        task_ids = self.client.zrange(status_key, 0, 0)
        if not task_ids:
            return None
        return task_ids[0]

    def _get_max_offset_activation(self, status: int) -> str | None:
        status_key = self._build_inflight_activations_key(status)
        task_ids = self.client.zrevrange(status_key, 0, 0)
        if not task_ids:
            return None
        return task_ids[0]

    def _get_all_tasks_with_status(self, status: int) -> list[str]:
        status_key = self._build_inflight_activations_key(status)
        tasks = self.client.zrange(status_key, 0, -1)
        return tasks

    def _get_score(self, status: int, task_id: str) -> int | None:
        status_key = self._build_inflight_activations_key(status)
        return int(self.client.zscore(status_key, task_id))

    def _count_all_offset_activations(self, status: int) -> int:
        key = self._build_inflight_activations_key(status)
        return self.client.zcard(key)

    def _remove_inflight_activation(self, task_id: str) -> None:
        # TODO: is there a better way to do this?
        fields = list(self._get_all_inflight_activation_fields(task_id).keys())
        if not fields:
            return
        self._remove_inflight_activation_field(task_id, *fields)

    def _remove_inflight_activation_field(self, task_id: str, *fields) -> None:
        key = self._build_inflight_activation_key(task_id)
        self.client.hdel(key, *fields)

    def _remove_inflight_activations(self, status: int, task_id: str) -> None:
        key = self._build_inflight_activations_key(status)
        self.client.zrem(key, task_id)

    def _remove_task(self, task_id: str) -> None:
        key = self._build_task_key(task_id)
        self.client.delete(key)

    def _compose_inflight_activation_proto(self, task_id: str) -> InflightActivation:
        task_json = self._get_task(task_id)
        task_proto = Parse(task_json, TaskActivation())
        inflight_dict = self._get_all_inflight_activation_fields(task_id)
        inflight_proto = ParseDict(inflight_dict, InflightActivation())
        inflight_proto.activation.CopyFrom(task_proto)
        return inflight_proto

    def store(self, batch: Sequence[InflightActivation]):
        for inflight in batch:
            task_id = inflight.activation.id
            status = inflight.status  # status is an integer
            offset = inflight.offset
            inflight_dict = MessageToDict(
                inflight, use_integers_for_enums=True, preserving_proto_field_name=True
            )
            task_json = MessageToJson(inflight.activation)

            self._set_task(task_id, task_json)
            del inflight_dict[
                "activation"
            ]  # remove the activation field as it is stored in a separate key
            self._set_inflight_activation_attributes(task_id, inflight_dict)
            self._set_inflight_activations(status, offset, task_id)

    def get_pending_task(self) -> InflightActivation | None:
        # TODO: can maybe use zpopmin instead here?
        with InflightTaskStoreRedis.RedisLock(self.client, self.redis_lock_namespace):
            task_id = self._get_min_offset_activation(TASK_ACTIVATION_STATUS_PENDING)
            if task_id is None:
                return None

            offset = self._get_inflight_activation_field(task_id, "offset")

            deadline = datetime.now() + timedelta(seconds=30)
            formatted_deadline = (
                deadline.isoformat() + "Z"
            )  # TODO: timestamps in task JSON are encoded as a string in RGC 3339 format "{year}-{month}-{day}T{hour}:{min}:{sec}[.{frac_sec}]Z"
            self._remove_inflight_activations(TASK_ACTIVATION_STATUS_PENDING, task_id)
            self._set_inflight_activations(TASK_ACTIVATION_STATUS_PROCESSING, offset, task_id)
            self._set_inflight_activation_attributes(
                task_id,
                {
                    "status": TASK_ACTIVATION_STATUS_PROCESSING,
                    "processing_deadline": formatted_deadline,
                },
            )
            return self._compose_inflight_activation_proto(task_id)

    def count_pending_task(self) -> int:
        with InflightTaskStoreRedis.RedisLock(self.client, self.redis_lock_namespace):
            return self._count_all_offset_activations(TASK_ACTIVATION_STATUS_PENDING)

    def set_task_status(self, task_id: str, task_status: TaskActivationStatus.ValueType):
        with InflightTaskStoreRedis.RedisLock(self.client, self.redis_lock_namespace):
            current_status = self._get_inflight_activation_field(task_id, "status")
            offset = self._get_inflight_activation_field(task_id, "offset")
            self._remove_inflight_activations(current_status, task_id)
            self._set_inflight_activations(task_status, offset, task_id)
            self._set_inflight_activation_attributes(task_id, {"status": task_status})
            if task_status == TASK_ACTIVATION_STATUS_RETRY:
                # Since task activation is serialized as JSON in redis, we need to deserialize it update the retry attempt
                task_json = self._get_task(task_id)
                task_proto = Parse(task_json, TaskActivation())
                new_retry_state = RetryState(
                    attempts=task_proto.retry_state.attempts + 1,
                    kind=task_proto.retry_state.kind,
                    discard_after_attempt=task_proto.retry_state.discard_after_attempt,
                    deadletter_after_attempt=task_proto.retry_state.deadletter_after_attempt,
                )
                task_proto.retry_state.CopyFrom(new_retry_state)
                self._set_task(task_id, MessageToJson(task_proto))

    def set_task_deadline(self, task_id: str, task_deadline: datetime | None):
        # Since task activation is serialized as JSON in redis, we need to deserialize it update the retry attempt
        with InflightTaskStoreRedis.RedisLock(self.client, self.redis_lock_namespace):
            task_json = self._get_task(task_id)
            task_proto = Parse(task_json, TaskActivation())
            new_task_activation = TaskActivation(
                id=task_proto.id,
                taskname=task_proto.taskname,
                parameters=task_proto.parameters,
                headers=task_proto.headers,
                received_at=task_proto.received_at,
                deadline=task_deadline,
                retry_state=task_proto.retry_state,
            )
            task_proto.CopyFrom(new_task_activation)
            self._set_task(task_id, MessageToJson(task_proto))

    def delete_task(self, task_id: str):
        with InflightTaskStoreRedis.RedisLock(self.client, self.redis_lock_namespace):
            current_status = self._get_inflight_activation_field(task_id, "status")
            self._remove_inflight_activations(current_status, task_id)
            self._remove_inflight_activation(task_id)
            self._remove_task(task_id)

    def handle_retry_state_tasks(self) -> None:
        from sentry.taskworker.config import taskregistry

        with InflightTaskStoreRedis.RedisLock(self.client, self.redis_lock_namespace):
            task_ids = self._get_all_tasks_with_status(TASK_ACTIVATION_STATUS_RETRY)
            for task_id in task_ids:
                task_json = self._get_task(task_id)
                task_proto = Parse(task_json, TaskActivation())
                task_ns = taskregistry.get(task_proto.namespace)
                task_proto.id = uuid4().hex
                task_ns.retry_task(task_proto)

                # With retries scheduled, the tasks are complete now.
                self._set_inflight_activation_attributes(
                    task_id, {"status": TASK_ACTIVATION_STATUS_COMPLETE}
                )
                self._remove_inflight_activations(TASK_ACTIVATION_STATUS_RETRY, task_id)
                offset = self._get_inflight_activation_field(task_id, "offset")
                self._set_inflight_activations(TASK_ACTIVATION_STATUS_COMPLETE, offset, task_id)

    def handle_deadletter_at(self) -> None:
        with InflightTaskStoreRedis.RedisLock(self.client, self.redis_lock_namespace):
            task_id = self._get_max_offset_activation(TASK_ACTIVATION_STATUS_COMPLETE)
            if not task_id:
                return
            max_completed_id = self._get_score(TASK_ACTIVATION_STATUS_COMPLETE, task_id) or 0

            task_ids = self._get_all_tasks_with_status(TASK_ACTIVATION_STATUS_PENDING)
            for id in task_ids:
                offset = self._get_inflight_activation_field(id, "offset")
                deadletter_at_field = self._get_inflight_activation_field(id, "deadletter_at")

                deadletter_at = Timestamp()
                deadletter_at.FromJsonString(deadletter_at_field)

                if deadletter_at.ToDatetime() < datetime.now() and offset < max_completed_id:
                    self._remove_inflight_activations(TASK_ACTIVATION_STATUS_PENDING, id)
                    self._set_inflight_activations(TASK_ACTIVATION_STATUS_FAILURE, offset, id)
                    self._set_inflight_activation_attributes(
                        id, {"status": TASK_ACTIVATION_STATUS_FAILURE}
                    )

    def handle_processing_deadlines(self) -> None:
        def has_retries_remaining(task_id: str) -> bool:
            task_json = self._get_task(task_id)
            task_proto = Parse(task_json, TaskActivation())
            if (
                task_proto.retry_state.deadletter_after_attempt is not None
                and task_proto.retry_state.attempts
                < task_proto.retry_state.deadletter_after_attempt
            ):
                return True
            if (
                task_proto.retry_state.discard_after_attempt is not None
                and task_proto.retry_state.attempts
                < task_proto.retry_state.deadletter_after_attempt
            ):
                return True
            return False

        with InflightTaskStoreRedis.RedisLock(self.client, self.redis_lock_namespace):
            all_task_ids = []
            for status in [
                TASK_ACTIVATION_STATUS_PENDING,
                TASK_ACTIVATION_STATUS_PROCESSING,
                TASK_ACTIVATION_STATUS_FAILURE,
                TASK_ACTIVATION_STATUS_RETRY,
            ]:
                all_task_ids.extend(self._get_all_tasks_with_status(status))

            past_deadline = []
            for task_id in all_task_ids:
                processing_deadline_field = self._get_inflight_activation_field(
                    task_id, "processing_deadline"
                )
                if not processing_deadline_field:
                    continue

                processing_deadline = Timestamp()
                processing_deadline.FromJsonString(processing_deadline_field)
                if processing_deadline.ToDatetime() < datetime.now():
                    past_deadline.append(task_id)

            to_update = []
            for task_id in past_deadline:
                if has_retries_remaining(task_id):
                    to_update.append(task_id)

            # Move processing deadline tasks back to pending
            for task_id in to_update:
                current_state = self._get_inflight_activation_field(task_id, "status")
                offset = self._get_inflight_activation_field(task_id, "offset")

                if current_state != TASK_ACTIVATION_STATUS_PENDING:
                    self._remove_inflight_activations(current_state, task_id)
                    self._set_inflight_activations(TASK_ACTIVATION_STATUS_PENDING, offset, task_id)
                self._set_inflight_activation_attributes(
                    task_id, {"status": TASK_ACTIVATION_STATUS_PENDING}
                )
                self._remove_inflight_activation_field(task_id, "processing_deadline")

            if len(to_update):
                logger.info("task.processingdeadline", extra={"count": len(to_update)})

    def handle_failed_tasks(self) -> None:
        with InflightTaskStoreRedis.RedisLock(self.client, self.redis_lock_namespace):
            failed = self._get_all_tasks_with_status(TASK_ACTIVATION_STATUS_FAILURE)
            to_discard = []
            to_deadletter = []
            for task_id in failed:
                task_json = self._get_task(task_id)
                task_proto = Parse(task_json, TaskActivation())
                if task_proto.retry_state.discard_after_attempt is not None:
                    to_discard.append(task_id)
                if task_proto.retry_state.deadletter_after_attempt is not None:
                    to_deadletter.append(task_id)

            # Discard messages are simply acked and never processed again
            for task_id in to_discard:
                offset = self._get_inflight_activation_field(task_id, "offset")
                self._remove_inflight_activations(TASK_ACTIVATION_STATUS_FAILURE, task_id)
                self._set_inflight_activations(TASK_ACTIVATION_STATUS_COMPLETE, offset, task_id)
                self._set_inflight_activation_attributes(
                    task_id, {"status": TASK_ACTIVATION_STATUS_COMPLETE}
                )

            # TODO do deadletter delivery
            for task_id in to_deadletter:
                offset = self._get_inflight_activation_field(task_id, "offset")
                self._remove_inflight_activations(TASK_ACTIVATION_STATUS_FAILURE, task_id)
                self._set_inflight_activations(TASK_ACTIVATION_STATUS_COMPLETE, offset, task_id)
                self._set_inflight_activation_attributes(
                    task_id, {"status": TASK_ACTIVATION_STATUS_COMPLETE}
                )

            if len(to_discard):
                logger.info("task.failed.discarded", extra={"count": len(to_discard)})
            if len(to_deadletter):
                logger.info("task.failed.deadletter", extra={"count": len(to_deadletter)})

    def remove_completed(self) -> None:
        with InflightTaskStoreRedis.RedisLock(self.client, self.redis_lock_namespace):
            lowest_incomplete = None
            for status in [
                TASK_ACTIVATION_STATUS_PENDING,
                TASK_ACTIVATION_STATUS_PROCESSING,
                TASK_ACTIVATION_STATUS_FAILURE,
                TASK_ACTIVATION_STATUS_RETRY,
            ]:
                task_id = self._get_min_offset_activation(status)
                if not task_id:
                    continue
                score = self._get_score(status, task_id)
                if score and not lowest_incomplete:
                    lowest_incomplete = score
                else:
                    lowest_incomplete = min(lowest_incomplete, score)

            if not lowest_incomplete:
                return

            # Only remove completed records that have lower offsets than the lowest
            # incomplete offset. We don't want to remove completed tasks that have
            # incomplete tasks with lower offsets as it can lead to dataloss due to worker
            # exhaustion.
            completed_task_ids = self._get_all_tasks_with_status(TASK_ACTIVATION_STATUS_COMPLETE)
            for task_id in completed_task_ids:
                offset = int(self._get_inflight_activation_field(task_id, "offset"))
                if offset < lowest_incomplete:
                    self._remove_inflight_activations(TASK_ACTIVATION_STATUS_COMPLETE, task_id)
                    self._remove_inflight_activation(task_id)
                    self._remove_task(task_id)


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
            deadline = datetime.now() + timedelta(seconds=30)

            # Use a single statement to get threadsafe updates.
            cursor = connection.execute(
                """
                UPDATE inflight_taskactivations
                SET processing_deadline = ?, status = ?
                WHERE id = (
                    SELECT id FROM inflight_taskactivations WHERE status = ? LIMIT 1
                )
                RETURNING id
                """,
                (
                    deadline.isoformat(),
                    Status.PROCESSING,
                    Status.PENDING,
                ),
            )
            row = cursor.fetchone()
            connection.commit()

            if not row:
                return None

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
            # TODO do retry state update?
            connection.execute(
                "UPDATE inflight_taskactivations SET status = ? WHERE id = ?",
                (model_status, task_id),
            )
            connection.commit()

    def set_task_deadline(self, task_id: str, task_deadline: datetime | None):
        # Set the deadline for a task
        with self.connection() as connection:
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
