from typing import int
from time import time

import sentry
from sentry import options
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import selfhosted_tasks


@instrumented_task(
    name="sentry.tasks.send_ping",
    namespace=selfhosted_tasks,
)
def send_ping() -> None:
    options.set("sentry:last_worker_ping", time())
    options.set("sentry:last_worker_version", sentry.VERSION)
