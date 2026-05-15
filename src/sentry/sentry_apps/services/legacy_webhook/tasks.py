from __future__ import annotations

import logging
from typing import Any

from requests.exceptions import ConnectionError, ReadTimeout, RequestException
from taskbroker_client.retry import Retry

from sentry.exceptions import RestrictedIPAddress
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import sentryapp_tasks

logger = logging.getLogger("sentry.legacy_webhook")


@instrumented_task(
    name="sentry.sentry_apps.services.legacy_webhook.tasks.send_legacy_webhook_task",
    namespace=sentryapp_tasks,
    retry=Retry(
        times=3,
        delay=60 * 5,
        on=(RequestException,),
        ignore=(RestrictedIPAddress, ConnectionError, ReadTimeout, ApiError),
    ),
    silo_mode=SiloMode.CELL,
)
def send_legacy_webhook_task(url: str, payload: dict[str, Any], **kwargs: Any) -> None:
    from .client import LegacyWebhookClient

    client = LegacyWebhookClient(payload)
    client.request(url)
