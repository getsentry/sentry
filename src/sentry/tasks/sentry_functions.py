from __future__ import annotations

from sentry.tasks.base import instrumented_task
from sentry.utils import json
from sentry.utils.cloudfunctions import publish_message

TASK_OPTIONS = {
    "queue": "app_platform",
    "default_retry_delay": (60 * 5),  # Five minutes.
    "max_retries": 3,
}


@instrumented_task("sentry.tasks.sentry_functions.send_sentry_function_webhook", **TASK_OPTIONS)
def send_sentry_function_webhook(sentry_function_id, event, data=None):
    publish_message(sentry_function_id, json.dumps({"data": data, "type": event}).encode())
