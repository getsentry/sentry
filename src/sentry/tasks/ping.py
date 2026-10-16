from time import time

import sentry
from sentry import application_state
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import selfhosted_tasks


@instrumented_task(
    name="sentry.tasks.send_ping",
    namespace=selfhosted_tasks,
)
def send_ping() -> None:
    application_state.set("sentry:last_worker_ping", time())
    application_state.set("sentry:last_worker_version", sentry.VERSION)
