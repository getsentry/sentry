from collections.abc import Mapping
from typing import Any

from sentry.integrations.models.integration import Integration
from sentry.integrations.tasks.sync_status_inbound import (
    sync_status_inbound as new_sync_status_inbound,
)
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry, track_group_async_operation


@instrumented_task(
    name="sentry.tasks.integrations.sync_status_inbound",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
    silo_mode=SiloMode.REGION,
)
@retry(exclude=(Integration.DoesNotExist,))
@track_group_async_operation
def sync_status_inbound(
    integration_id: int, organization_id: int, issue_key: str, data: Mapping[str, Any]
) -> None:
    new_sync_status_inbound(integration_id, organization_id, issue_key, data)
