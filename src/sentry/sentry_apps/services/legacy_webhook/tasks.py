from __future__ import annotations

import enum
import logging
from typing import Any

from requests.exceptions import ConnectionError, ReadTimeout
from taskbroker_client.retry import Retry

from sentry.exceptions import RestrictedIPAddress
from sentry.sentry_apps.services.legacy_webhook.client import LegacyWebhookClient
from sentry.sentry_apps.services.legacy_webhook.service import LegacyWebhookPayload
from sentry.sentry_apps.utils.idempotency import derive_idempotency_key
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import sentryapp_tasks
from sentry.utils import metrics


class LegacyWebhookOutcome(str, enum.Enum):
    SENT = "sent"
    ERROR = "error"


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
def send_legacy_webhook_task(
    url: str,
    payload: LegacyWebhookPayload,
    idempotency_seed: str | None = None,
    destination_index: int | None = None,
    **kwargs: Any,
) -> None:
    client = LegacyWebhookClient(payload)
    # Configured URL entries have indexes, so duplicate entries remain distinct.
    # For a reconstructed delivery without the index, the URL is a stable fallback.
    destination_id = destination_index if destination_index is not None else url
    key = derive_idempotency_key(idempotency_seed, "legacy-url", destination_id)
    try:
        if key is not None:
            client.request(url, headers={"Idempotency-Key": key})
        else:
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
