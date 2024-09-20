from __future__ import annotations

import logging
import time

from django.conf import settings

from sentry.taskworker.config import TaskNamespace, taskregistry
from sentry.taskworker.models import PendingTasks

logger = logging.getLogger("sentry.taskworker")


class Worker:
    __namespace: TaskNamespace | None = None

    def __init__(self, **options):
        self.options = options
        self.exitcode = None

    @property
    def namespace(self) -> TaskNamespace:
        if self.__namespace:
            return self.__namespace

        name = self.options["namespace"]
        self.__namespace = taskregistry.get(name)
        return self.__namespace

    def do_imports(self) -> None:
        for module in settings.TASKWORKER_IMPORTS:
            __import__(module)

    def start(self) -> None:
        self.do_imports()
        try:
            while True:
                self.process_tasks(self.namespace)
        except KeyboardInterrupt:
            self.exitcode = 1
        except Exception:
            logger.exception("Worker process crashed")

    def process_tasks(self, namespace: TaskNamespace) -> None:
        from sentry.taskworker.service.service import task_service

        # This emulates an RPC service interface.
        task_data = task_service.get_task(topic=namespace.topic)
        if task_data is None:
            logger.info("No tasks")
            time.sleep(1)
            return

        try:
            task_meta = self.namespace.get(task_data.task_name)
        except KeyError:
            logger.exception("Could not resolve task with name %s", task_data.task_name)
            return

        # TODO: Check idempotency
        next_state = PendingTasks.States.FAILURE

        task_added_time = task_data.added_at.timestamp()
        execution_time = time.time()
        try:
            task_meta(*task_data.parameters["args"], **task_data.parameters["kwargs"])
            next_state = PendingTasks.States.COMPLETE
        except Exception as err:
            logger.info("taskworker.task_errored", extra={"error": str(err)})
            # TODO check retry policy
            if task_meta.should_retry(task_data.retry_state(), err):
                logger.info("taskworker.task.retry", extra={"task": task_data.task_name})
                next_state = PendingTasks.States.RETRY

        task_latency = execution_time - task_added_time
        logger.info("task.complete", extra={"latency": task_latency})

        if next_state == PendingTasks.States.COMPLETE:
            logger.info("taskworker.task.complete", extra={"task": task_data.task_name})
            task_service.complete_task(task_id=task_data.id)
        else:
            logger.info(
                "taskworker.task.change_status",
                extra={"task": task_data.task_name, "state": next_state},
            )
            task_service.set_task_status(
                task_id=task_data.id,
                task_status=next_state,
            )
