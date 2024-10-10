import logging
from abc import abstractmethod
from collections.abc import Sequence
from datetime import datetime, timedelta
from uuid import uuid4

from django.conf import settings
from django.db import router, transaction
from django.db.models import Max
from django.utils import timezone
from google.protobuf.json_format import MessageToDict, MessageToJson, Parse, ParseDict
from sentry_protos.sentry.v1alpha.taskworker_pb2 import (
    TASK_ACTIVATION_STATUS_PENDING,
    TASK_ACTIVATION_STATUS_PROCESSING,
    TASK_ACTIVATION_STATUS_RETRY,
    InflightActivation,
    RetryState,
    TaskActivation,
    TaskActivationStatus,
)

from sentry.utils import redis

logger = logging.getLogger("sentry.taskworker.consumer")


class InflightActivationStore:
    @abstractmethod
    def store(self, batch: Sequence[InflightActivation]):
        # Takes in a batch of pending tasks and stores them in some datastore
        pass

    @abstractmethod
    def get_pending_task(self) -> InflightActivation | None:
        pass

    @abstractmethod
    def count_pending_task(self) -> int:
        pass

    @abstractmethod
    def set_task_status(self, task_id: str, task_status: TaskActivationStatus.ValueType):
        pass

    @abstractmethod
    def set_task_deadline(self, task_id: str, task_deadline: datetime | None):
        pass

    @abstractmethod
    def delete_task(self, task_id: str):
        pass

    @abstractmethod
    def handle_retry_state_tasks(self) -> None:
        pass

    @abstractmethod
    def handle_deadletter_at(self) -> None:
        pass

    @abstractmethod
    def handle_processing_deadlines(self) -> None:
        pass

    @abstractmethod
    def handle_failed_tasks(self) -> None:
        pass

    @abstractmethod
    def remove_completed(self) -> None:
        pass


class PostgresInflightActivationStore(InflightActivationStore):
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


class RedisInflightActivationStore(InflightActivationStore):
    """
    KEY STRUCTURE:
    TODO: Add key structure here
    TODO: namespace by partition and topic

    """

    def __init__(self):
        self.do_imports()
        self.client = redis.redis_clusters.get("default")  # set to default for now
        self.namespace = "taskworker"

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

    def _get_lowest_offset_activation(self, status: int) -> str | None:
        status_key = self._build_inflight_activations_key(status)
        earliest_tasks = self.client.zrange(status_key, 0, 0)
        if not earliest_tasks:
            return None
        return earliest_tasks[0]

    def _count_all_offset_activations(self, status: int) -> int:
        key = self._build_inflight_activations_key(status)
        return self.client.zcount(key, "-inf", "+inf")

    def _remove_inflight_activation(self, task_id: str) -> None:
        # TODO: is there a better way to do this?
        key = self._build_inflight_activation_key(task_id)
        fields = list(self._get_all_inflight_activation_fields(task_id).keys())
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
            inflight_dict = MessageToDict(inflight, use_integers_for_enums=True)
            task_json = MessageToJson(inflight.activation)

            self._set_task(task_id, task_json)
            del inflight_dict[
                "activation"
            ]  # remove the activation field as it is stored separately
            self._set_inflight_activation_attributes(task_id, inflight_dict)
            self._set_inflight_activations(status, offset, task_id)

    def get_pending_task(self) -> InflightActivation | None:
        task_id = self._get_lowest_offset_activation(TASK_ACTIVATION_STATUS_PENDING)
        if task_id is None:
            return None

        offset = self._get_inflight_activation_field(task_id, "offset")

        deadline = datetime.now() + timedelta(seconds=30)
        formatted_deadline = (
            deadline.isoformat() + "Z"
        )  # timestamps in task JSON are encoded as a string in RGC 3339 format "{year}-{month}-{day}T{hour}:{min}:{sec}[.{frac_sec}]Z"
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
        return self._count_all_offset_activations(TASK_ACTIVATION_STATUS_PENDING)

    def set_task_status(self, task_id: str, task_status: TaskActivationStatus.ValueType):
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
        current_status = self._get_inflight_activation_field(task_id, "status")
        self._remove_inflight_activations(current_status, task_id)
        self._remove_inflight_activation(task_id)
        self._remove_task(task_id)

    def handle_retry_state_tasks(self) -> None:
        # from sentry.taskworker.config import taskregistry
        # from sentry.taskworker.models import InflightActivationModel

        # with transaction.atomic(using=router.db_for_write(InflightActivationModel)):
        #     retry_qs = InflightActivationModel.objects.filter(
        #         status=InflightActivationModel.Status.RETRY
        #     )
        #     for item in retry_qs:
        #         task_ns = taskregistry.get(item.namespace)
        #         task_proto = item.to_proto()
        #         task_proto.activation.id = uuid4().hex
        #         task_ns.retry_task(task_proto.activation)

        #     # With retries scheduled, the tasks are complete now.
        #     retry_qs.update(status=InflightActivationModel.Status.COMPLETE)
        pass

    def handle_deadletter_at(self) -> None:
        # from sentry.taskworker.models import InflightActivationModel

        # with transaction.atomic(using=router.db_for_write(InflightActivationModel)):
        #     # Require a completed task with a higher offset to be present
        #     max_completed_id = (
        #         InflightActivationModel.objects.filter(
        #             status=InflightActivationModel.Status.COMPLETE
        #         ).aggregate(max_offset=Max("offset"))["max_offset"]
        #         or 0
        #     )
        #     expired_qs = InflightActivationModel.objects.filter(
        #         deadletter_at__lt=timezone.now(),
        #         offset__lt=max_completed_id,
        #         status=InflightActivationModel.Status.PENDING,
        #     )
        #     # Messages that are still pending and exceeded their deadletter_at are failures
        #     updated = expired_qs.update(status=InflightActivationModel.Status.FAILURE)
        # if updated:
        #     logger.info("task.deadletter_at", extra={"count": updated})
        pass

    def handle_processing_deadlines(self) -> None:
        # from sentry.taskworker.models import InflightActivationModel

        # with transaction.atomic(using=router.db_for_write(InflightActivationModel)):
        #     past_deadline = InflightActivationModel.objects.filter(
        #         processing_deadline__lt=timezone.now(),
        #     ).exclude(status=InflightActivationModel.Status.COMPLETE)
        #     to_update = []
        #     for item in past_deadline:
        #         if item.has_retries_remaining():
        #             to_update.append(item.id)

        #     # Move processing deadline tasks back to pending
        #     InflightActivationModel.objects.filter(id__in=to_update).update(
        #         status=InflightActivationModel.Status.PENDING,
        #         processing_deadline=None,
        #     )
        # if len(to_update):
        #     logger.info("task.processingdeadline", extra={"count": len(to_update)})
        pass

    def handle_failed_tasks(self) -> None:
        # from sentry.taskworker.models import InflightActivationModel

        # with transaction.atomic(using=router.db_for_write(InflightActivationModel)):
        #     failed = InflightActivationModel.objects.filter(
        #         status=InflightActivationModel.Status.FAILURE
        #     )
        #     to_discard = []
        #     to_deadletter = []
        #     for item in failed:
        #         if item.discard_after_attempt is not None:
        #             to_discard.append(item.id)
        #         if item.deadletter_after_attempt is not None:
        #             to_deadletter.append(item.id)

        #     # Discard messages are simply acked and never processed again
        #     InflightActivationModel.objects.filter(id__in=to_discard).update(
        #         status=InflightActivationModel.Status.COMPLETE
        #     )
        #     # TODO do deadletter delivery
        #     InflightActivationModel.objects.filter(id__in=to_deadletter).update(
        #         status=InflightActivationModel.Status.COMPLETE
        #     )

        # if len(to_discard):
        #     logger.info("task.failed.discarded", extra={"count": len(to_discard)})
        # if len(to_deadletter):
        #     logger.info("task.failed.deadletter", extra={"count": len(to_deadletter)})
        pass

    def remove_completed(self) -> None:
        # from sentry.taskworker.models import InflightActivationModel

        # with transaction.atomic(using=router.db_for_write(InflightActivationModel)):
        #     lowest_incomplete = (
        #         InflightActivationModel.objects.exclude(
        #             status=InflightActivationModel.Status.COMPLETE,
        #         )
        #         .order_by("-offset")
        #         .values_list("offset", flat=True)
        #         .first()
        #     )
        #     if not lowest_incomplete:
        #         return

        #     # Only remove completed records that have lower offsets than the lowest
        #     # incomplete offset. We don't want to remove completed tasks that have
        #     # incomplete tasks with lower offsets as it can lead to dataloss due to worker
        #     # exhaustion.
        #     query = InflightActivationModel.objects.filter(
        #         status=InflightActivationModel.Status.COMPLETE,
        #         offset__lt=lowest_incomplete,
        #     )
        #     query.delete()
        pass
