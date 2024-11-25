import logging
import time

from sentry.runner import configure

configure()

from sentry.taskworker.registry import taskregistry
from sentry.taskworker.task import Task
from sentry.taskworker.worker import TaskWorker


def do_things() -> None:
    logging.info("Ran do_things")


task_namespace = taskregistry.create_namespace("test")

no_retry_task = Task(
    name="test.no_retry",
    func=do_things,
    namespace=task_namespace,
    retry=None,
)

logging.info("Sending task")
task_namespace.send_task(no_retry_task.create_activation())

time.sleep(5)

logging.info("Fetching task")
taskworker = TaskWorker(rpc_host="localhost:50051", max_task_count=100)
task = taskworker.fetch_task()

logging.info(task)
