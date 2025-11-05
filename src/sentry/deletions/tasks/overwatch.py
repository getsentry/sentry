import hashlib
import hmac
import logging
from typing import Any

import requests
from django.conf import settings

from sentry import options
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import deletion_tasks
from sentry.types.region import get_local_region
from sentry.utils import json, metrics

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.deletions.overwatch_notify_organization_deleted",
    namespace=deletion_tasks,
    max_retries=3,
    default_retry_delay=60,
)
def notify_overwatch_organization_deleted(
    organization_id: int, organization_slug: str, **kwargs: Any
) -> None:
    """
    Notify Overwatch for the current region that an organization has been deleted.
    Sends organization_id and slug to the /webhooks/sentry endpoint for the local region.
    """
    if not settings.OVERWATCH_WEBHOOK_SECRET:
        logger.warning(
            "overwatch.organization_deleted.no_secret",
            extra={"organization_id": organization_id, "organization_slug": organization_slug},
        )
        return

    try:
        local_region = get_local_region()
        region_name = local_region.name
    except Exception as e:
        logger.exception(
            "overwatch.organization_deleted.region_error",
            extra={
                "organization_id": organization_id,
                "organization_slug": organization_slug,
                "error": str(e),
            },
        )
        return

    # Check if this region is enabled for Overwatch notifications
    enabled_regions = options.get("overwatch.enabled-regions")
    if not enabled_regions or region_name not in enabled_regions:
        logger.debug(
            "overwatch.organization_deleted.region_not_enabled",
            extra={
                "organization_id": organization_id,
                "organization_slug": organization_slug,
                "region_name": region_name,
            },
        )
        return

    # Get the Overwatch URL
    base_url = settings.OVERWATCH_REGION_URL
    if not base_url:
        logger.warning(
            "overwatch.organization_deleted.missing_region_url",
            extra={
                "organization_id": organization_id,
                "organization_slug": organization_slug,
                "region_name": region_name,
            },
        )
        metrics.incr(
            "overwatch.organization_deleted.sent",
            amount=1,
            tags={"status": "failure", "region": region_name},
        )
        return

    payload_data = {
        "event_type": "organization_delete",
        "organization_id": organization_id,
        "organization_slug": organization_slug,
        "region": region_name,
    }
    payload = json.dumps(payload_data).encode("utf-8")

    signature = hmac.new(
        settings.OVERWATCH_WEBHOOK_SECRET.encode("utf-8"),
        payload,
        hashlib.sha256,
    ).hexdigest()

    headers = {
        "content-type": "application/json;charset=utf-8",
        "x-sentry-overwatch-signature": signature,
    }

    try:
        endpoint = f"{base_url}/webhooks/sentry"
        response = requests.post(
            endpoint,
            data=payload,
            headers=headers,
            timeout=10,
        )
        response.raise_for_status()

        logger.info(
            "overwatch.organization_deleted.success",
            extra={
                "organization_id": organization_id,
                "organization_slug": organization_slug,
                "region_name": region_name,
                "status_code": response.status_code,
            },
        )
        metrics.incr(
            "overwatch.organization_deleted.sent",
            amount=1,
            tags={"status": "success", "region": region_name},
        )

    except requests.RequestException as e:
        logger.exception(
            "overwatch.organization_deleted.failed",
            extra={
                "organization_id": organization_id,
                "organization_slug": organization_slug,
                "region_name": region_name,
                "error": str(e),
            },
        )
        metrics.incr(
            "overwatch.organization_deleted.sent",
            amount=1,
            tags={"status": "failure", "region": region_name},
        )
