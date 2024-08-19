from __future__ import annotations

from django.conf import settings
import logging
import time


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

    def process_tasks(self, namespace: TaskNamespace) -> None:
        from sentry.taskworker.service.service import task_service

        task_data = task_service.get_task(topic=namespace.topic)
        if task_data is None:
            logger.info("No tasks")
            time.sleep(1)
            return

        try:
            # TODO this won't work until PendingTasks has tasknames
            # task_meta = self.namespace.get(task_data.taskname)
            task_inst = self.namespace.get("demos.say_hello")
        except KeyError as e:
            logging.exception("Could not resolve task with name %s", task_data.taskname)
            return

        # TODO: Check idempotency
        complete = False
        try:
            # TODO this won't work until PendingTasks has parameters
            # task_meta(*task_data.parameters["args"], **task_data.parameters["kwargs"])
            task_inst(*["mark"])
            complete = True
        except Exception as err:
            logging.info("Task failed to execute %s", err)
            # TODO check retry policy

        if complete:
            task_service.complete_task(task_id=task_data.id)
        else:
            task_service.set_task_status(task_id=task_data.id, task_status=PendingTasks.States.FAILURE)
