from __future__ import annotations

import logging
import time

import orjson
from django.conf import settings
from sentry_protos.hackweek_team_no_celery_pls.v1alpha.pending_task_pb2 import (
    COMPLETE,
    FAILURE,
    RETRY,
)

from sentry.taskworker.config import TaskNamespace, taskregistry

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
        from sentry.taskworker.service.client import task_client

        task_data = task_client.get_task(topic=namespace.topic)
        if not task_data:
            logger.info("No tasks")
            time.sleep(1)
            return

        try:
            task_meta = self.namespace.get(task_data.work.taskname)
        except KeyError:
            logger.exception("Could not resolve task with name %s", task_data.work.taskname)
            return

        # TODO: Check idempotency
        task_added_time = task_data.added_at.timestamp()
        execution_time = time.time()
        next_state = FAILURE
        try:
            task_data_parameters = orjson.loads(task_data.work.parameters)
            task_meta(*task_data_parameters["args"], **task_data_parameters["kwargs"])
            next_state = COMPLETE
        except Exception as err:
            logger.info("taskworker.task_errored", extra={"error": str(err)})
            # TODO check retry policy
            if task_meta.should_retry(task_data.work.retry_state, err):
                logger.info("taskworker.task.retry", extra={"task": task_data.work.taskname})
                next_state = RETRY
        task_latency = execution_time - task_added_time
        logger.info("task.complete", extra={"latency": task_latency})

        if next_state == COMPLETE:
            logger.info("taskworker.task.complete", extra={"task": task_data.work.taskname})
            task_client.complete_task(task_id=task_data.store_id)
        else:
            logger.info(
                "taskworker.task.change_status",
                extra={"task": task_data.work.taskname, "state": next_state},
            )
            task_client.set_task_status(
                task_id=task_data.store_id,
                task_status=next_state,
            )
