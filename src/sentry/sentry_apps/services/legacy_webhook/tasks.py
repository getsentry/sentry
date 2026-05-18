from __future__ import annotations

import logging
from typing import Any

from requests.exceptions import ConnectionError, ReadTimeout
from taskbroker_client.retry import Retry

from sentry import features
from sentry.exceptions import RestrictedIPAddress
from sentry.models.group import Group
from sentry.sentry_apps.services.legacy_webhook.client import LegacyWebhookClient
from sentry.sentry_apps.services.legacy_webhook.service import LegacyWebhookPayload
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
        on=(Exception,),
        ignore=(RestrictedIPAddress, ConnectionError, ReadTimeout, ApiError),
    ),
    silenced_exceptions=(RestrictedIPAddress, ConnectionError, ReadTimeout, ApiError),
    silo_mode=SiloMode.CELL,
)
def send_legacy_webhook_task(url: str, payload: LegacyWebhookPayload, **kwargs: Any) -> None:
    try:
        group = Group.objects.get(id=int(payload["id"]))
    except Group.DoesNotExist:
        logger.warning(
            "legacy_webhook.group_not_found",
            extra={"group_id": payload["id"], "url": url},
        )
        return
    organization = group.project.organization

    if features.has("organizations:legacy-webhook-dry-run", organization):
        logger.info(
            "legacy_webhook.dry_run",
            extra={
                "url": url,
                "payload": payload,
            },
        )
        return

    client = LegacyWebhookClient(payload)
    client.request(url)
