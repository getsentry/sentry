import logging
from collections.abc import Sequence
from datetime import datetime, timedelta
from uuid import uuid4

from django.conf import settings
from django.db.models import Max
from django.utils import timezone
from sentry_protos.sentry.v1alpha.taskworker_pb2 import InflightActivation, TaskActivationStatus

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
        from django.db import router, transaction

        from sentry.taskworker.models import InflightActivationModel

        with transaction.atomic(using=router.db_for_write(InflightActivationModel)):
            query_set = InflightActivationModel.objects.filter(
                status=InflightActivationModel.Status.PENDING
            )

            task = query_set.first()
            if task is None:
                return None

            # TODO this duration should be a tasknamespace setting, or with an option
            deadline = datetime.now() + timedelta(minutes=3)

            task.update(
                status=InflightActivationModel.Status.PROCESSING, processing_deadline=deadline
            )
            return task.to_proto()

    def set_task_status(self, task_id: str, task_status: TaskActivationStatus.ValueType):
        from django.db import router, transaction

        from sentry.taskworker.models import InflightActivationModel

        task_status = InflightActivationModel.to_model_status(task_status)

        with transaction.atomic(using=router.db_for_write(InflightActivationModel)):
            # Pull a select for update here to lock the row while we mutate the retry count
            task = InflightActivationModel.objects.select_for_update().filter(id=task_id).get()

            task.update(status=task_status)
            if task_status == InflightActivationModel.Status.RETRY:
                task.update(retry_attempts=task.retry_attempts + 1)

    def set_task_deadline(self, task_id: str, task_deadline: datetime | None):
        from django.db import router, transaction

        from sentry.taskworker.models import InflightActivationModel

        with transaction.atomic(using=router.db_for_write(InflightActivationModel)):
            # Pull a select for update here to lock the row while we mutate the retry count
            task = InflightActivationModel.objects.select_for_update().filter(id=task_id).get()
            task.update(deadline=task_deadline)

    def delete_task(self, task_id: str):
        from django.db import router, transaction

        from sentry.taskworker.models import InflightActivationModel

        with transaction.atomic(using=router.db_for_write(InflightActivationModel)):
            task = InflightActivationModel.objects.select_for_update().filter(id=task_id).get()
            task.delete()

    def handle_retry_state_tasks(self) -> None:
        from sentry.taskworker.config import taskregistry
        from sentry.taskworker.models import InflightActivationModel

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
        if len(to_discard):
            logger.info("task.failed.discarded", extra={"count": len(to_discard)})

        # TODO do deadletter delivery
        InflightActivationModel.objects.filter(id__in=to_deadletter).update(
            status=InflightActivationModel.Status.COMPLETE
        )
        if len(to_deadletter):
            logger.info("task.failed.deadletter", extra={"count": len(to_deadletter)})
