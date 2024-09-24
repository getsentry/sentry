import logging
from collections.abc import Sequence
from datetime import timedelta

from django.db.models import Max
from django.utils import timezone
from sentry_protos.sentry.v1alpha.taskworker_pb2 import InflightActivation, TaskActivationStatus

logger = logging.getLogger("sentry.taskworker.consumer")


class PendingTaskStore:
    def store(self, batch: Sequence[InflightActivation]):
        # Takes in a batch of pending tasks and stores them in some datastore
        from sentry.taskworker.models import PendingTasks

        PendingTasks.objects.bulk_create([PendingTasks.from_proto(task) for task in batch])

    def get_pending_task(
        self, partition: int | None = None, topic: str | None = None
    ) -> InflightActivation | None:
        from django.db import router, transaction

        from sentry.taskworker.models import PendingTasks

        with transaction.atomic(using=router.db_for_write(PendingTasks)):
            query_set = PendingTasks.objects.filter(state=PendingTasks.States.PENDING)

            if partition is not None:
                query_set = query_set.filter(partition=partition)

            if topic is not None:
                query_set = query_set.filter(topic=topic)

            task = query_set.first()
            if task is None:
                return None

            # TODO this duration should be a tasknamespace setting, or with an option
            deadline = task.added_at + timedelta(minutes=3)

            task.update(state=PendingTasks.States.PROCESSING, processing_deadline=deadline)
            return task.to_proto()

    def set_task_status(self, task_id: str, task_status: TaskActivationStatus.ValueType):
        from django.db import router, transaction

        from sentry.taskworker.models import PendingTasks

        task_status = PendingTasks.to_model_status(task_status)

        with transaction.atomic(using=router.db_for_write(PendingTasks)):
            # Pull a select for update here to lock the row while we mutate the retry count
            task = PendingTasks.objects.select_for_update().filter(id=task_id).get()

            task.update(state=task_status)
            if task_status == PendingTasks.States.RETRY:
                task.update(retry_attempts=task.retry_attempts + 1)

    def handle_retry_state_tasks(self) -> None:
        from sentry.taskworker.config import taskregistry
        from sentry.taskworker.models import PendingTasks

        retry_qs = PendingTasks.objects.filter(state=PendingTasks.States.RETRY)
        for item in retry_qs:
            task_ns = taskregistry.get(item.task_namespace)
            task_ns.retry_task(item)
        # With retries scheduled, the tasks are complete now.
        retry_qs.update(state=PendingTasks.States.COMPLETE)

    def handle_deadletter_at(self) -> None:
        from sentry.taskworker.models import PendingTasks

        # Require a completed task with a higher offset to be present
        max_completed_id = (
            PendingTasks.objects.filter(state=PendingTasks.States.COMPLETE).aggregate(
                max_offset=Max("offset")
            )["max_offset"]
            or 0
        )
        expired_qs = PendingTasks.objects.filter(
            deadletter_at__lt=timezone.now(),
            offset__lt=max_completed_id,
            state=PendingTasks.States.PENDING,
        )
        # Messages that are still pending and exceeded their deadletter_at are failures
        updated = expired_qs.update(state=PendingTasks.States.FAILURE)
        logger.debug("task.deadletter_at", extra={"count": updated})

    def handle_processing_deadlines(self) -> None:
        from sentry.taskworker.models import PendingTasks

        past_deadline = PendingTasks.objects.filter(
            processing_deadline__lt=timezone.now(),
        ).exclude(state=PendingTasks.States.COMPLETE)
        to_update = []
        for item in past_deadline:
            if item.has_retries_remaining():
                to_update.append(item.id)

        # Move processing deadline tasks back to pending
        PendingTasks.objects.filter(id__in=to_update).update(
            state=PendingTasks.States.PENDING,
            processing_deadline=None,
        )
        logger.debug("task.processingdeadline", extra={"count": len(to_update)})

    def handle_failed_tasks(self) -> None:
        from sentry.taskworker.models import PendingTasks

        failed = PendingTasks.objects.filter(state=PendingTasks.States.FAILURE)
        to_discard = []
        to_deadletter = []
        for item in failed:
            if item.discard_after_attempt is not None:
                to_discard.append(item.id)
            if item.deadletter_after_attempt is not None:
                to_deadletter.append(item.id)

        # Discard messages are simply acked and never processed again
        PendingTasks.objects.filter(id__in=to_discard).update(state=PendingTasks.States.COMPLETE)
        logger.debug("task.failed.discarded", extra={"count": len(to_discard)})

        # TODO do deadletter delivery
        PendingTasks.objects.filter(id__in=to_deadletter).update(state=PendingTasks.States.COMPLETE)
        logger.debug("task.failed.deadletter", extra={"count": len(to_deadletter)})
        logger.debug("task.failed.deadletter", extra={"count": len(to_deadletter)})
