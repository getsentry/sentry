from __future__ import annotations

from sentry.api.serializers import serialize
from sentry.models.group import Group
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.utils import json
from sentry.utils.cloudfunctions import publish_message

TASK_OPTIONS = {
    "queue": "app_platform",
    "default_retry_delay": (60 * 5),  # Five minutes.
    "max_retries": 3,
}


@instrumented_task(
    "sentry.tasks.sentry_functions.send_sentry_function_webhook",
    acks_late=True,
    silo_mode=SiloMode.REGION,
    **TASK_OPTIONS,
)
@retry
def send_sentry_function_webhook(sentry_function_id, event, issue_id, data=None):
    try:
        data["issue"] = serialize(Group.objects.get(id=issue_id))
    except Group.DoesNotExist:
        pass
    publish_message(sentry_function_id, json.dumps({"data": data, "type": event}).encode())
