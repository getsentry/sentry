from time import time

import sentry
from sentry import options
from sentry.tasks.base import instrumented_task


@instrumented_task(name="sentry.tasks.send_ping")
def send_ping():
    options.set("sentry:last_worker_ping", time())
    options.set("sentry:last_worker_version", sentry.VERSION)
