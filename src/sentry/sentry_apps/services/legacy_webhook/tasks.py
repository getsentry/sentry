from __future__ import annotations

import enum
import logging
from typing import Any

from requests.exceptions import ConnectionError, ReadTimeout
from taskbroker_client.retry import Retry

from sentry.exceptions import RestrictedIPAddress
from sentry.models.group import Group
from sentry.sentry_apps.services.legacy_webhook.client import LegacyWebhookClient
from sentry.sentry_apps.services.legacy_webhook.service import LegacyWebhookPayload
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import sentryapp_tasks
from sentry.utils import metrics


class LegacyWebhookOutcome(str, enum.Enum):
    SENT = "sent"
    ERROR = "error"
    GROUP_NOT_FOUND = "group_not_found"


logger = logging.getLogger("sentry.legacy_webhook")


@instrumented_task(
    name="sentry.sentry_apps.services.legacy_webhook.tasks.send_legacy_webhook_task",
    namespace=sentryapp_tasks,
    retry=Retry(
        times=3,
        delay=60 * 5,
        on=(Exception,),
        ignore=(RestrictedIPAddress, ConnectionError, ReadTimeout, ApiError),
    ),
    silenced_exceptions=(RestrictedIPAddress, ConnectionError, ReadTimeout, ApiError),
    silo_mode=SiloMode.CELL,
)
def send_legacy_webhook_task(url: str, payload: LegacyWebhookPayload, **kwargs: Any) -> None:
    try:
        Group.objects.get(id=int(payload["id"]))
    except Group.DoesNotExist:
        logger.warning(
            "legacy_webhook.group_not_found",
            extra={"group_id": payload["id"], "url": url},
        )
        metrics.incr(
            "legacy_webhook.task.result",
            tags={"outcome": LegacyWebhookOutcome.GROUP_NOT_FOUND},
            sample_rate=1.0,
        )
        return

    client = LegacyWebhookClient(payload)
    try:
        client.request(url)
    except (RestrictedIPAddress, ConnectionError, ReadTimeout, ApiError):
        metrics.incr(
            "legacy_webhook.task.result",
            tags={"outcome": LegacyWebhookOutcome.ERROR},
            sample_rate=1.0,
        )
        raise
    metrics.incr(
        "legacy_webhook.task.result",
        tags={"outcome": LegacyWebhookOutcome.SENT},
        sample_rate=1.0,
    )
