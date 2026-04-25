from __future__ import annotations

import logging
from typing import Any

from sentry.seer.code_review.utils import ClientError, SeerEndpoint, make_seer_request
from sentry.seer.signed_seer_api import SeerViewerContext
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_code_review_tasks

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.seer.notify_code_review_organization_offboarded",
    namespace=seer_code_review_tasks,
    silo_mode=SiloMode.CELL,
)
def notify_code_review_organization_offboarded(
    organization_id: int,
    **kwargs: Any,
) -> None:
    """
    Tell Seer to delete code-review data for a Sentry organization.

    Scheduled when the organization is marked ``PENDING_DELETION`` (committed request
    to remove the org) so Seer can purge customer data without waiting for the async
    deletion worker. Seer should treat this as idempotent. Cancelling deletion in
    Sentry does not send a follow-up; coordinate with Seer if undo is required.
    """
    viewer_context = SeerViewerContext(organization_id=organization_id)
    try:
        make_seer_request(
            path=SeerEndpoint.CODE_REVIEW_ORGANIZATION_OFFBOARD.value,
            payload={"organization_id": organization_id},
            viewer_context=viewer_context,
        )
    except ClientError as err:
        # 4xx includes "no data" style responses; do not retry.
        logger.info(
            "notify_code_review_organization_offboarded.client_error",
            extra={"organization_id": organization_id, "error": str(err)},
        )
    except Exception:
        logger.exception(
            "notify_code_review_organization_offboarded.failed",
            extra={"organization_id": organization_id},
        )
        raise
