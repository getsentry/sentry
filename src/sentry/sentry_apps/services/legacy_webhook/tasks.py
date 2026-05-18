from __future__ import annotations

import logging
from typing import Any

from taskbroker_client.retry import Retry

from sentry import features
from sentry.models.project import Project
from sentry.sentry_apps.services.legacy_webhook.client import LegacyWebhookClient
from sentry.sentry_apps.services.legacy_webhook.service import LegacyWebhookPayload
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
    ),
    silo_mode=SiloMode.CELL,
)
def send_legacy_webhook_task(
    url: str, payload: LegacyWebhookPayload, project_id: int, **kwargs: Any
) -> None:
    project = Project.objects.get_from_cache(id=project_id)
    organization = project.organization

    if features.has("organizations:legacy-webhook-dry-run", organization):
        logger.info(
            "legacy_webhook.dry_run",
            extra={
                "project_id": project_id,
                "url": url,
                "payload": payload,
            },
        )
        return

    client = LegacyWebhookClient(payload)
    client.request(url)
