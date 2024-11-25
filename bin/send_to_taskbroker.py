import logging

from sentry.runner import configure

configure()

from sentry.taskworker.registry import taskregistry
from sentry.taskworker.task import Task


def do_things() -> None:
    logging.info("Ran do_things")


task_namespace = taskregistry.create_namespace("test")

no_retry_task = Task(
    name="test.no_retry",
    func=do_things,
    namespace=task_namespace,
    retry=None,
)

task_namespace.send_task(no_retry_task.create_activation())
