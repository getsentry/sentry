import logging
from typing import Any

from taskbroker_client.retry import Retry
from urllib3.exceptions import HTTPError

from sentry.seer.code_review.utils import SeerEndpoint, make_seer_request
from sentry.seer.signed_seer_api import SeerViewerContext
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import deletion_tasks

logger = logging.getLogger(__name__)

_MAX_RETRIES = 3
_RETRY_DELAY_S = 60


@instrumented_task(
    name="sentry.deletions.seer_notify_organization_deleted",
    namespace=deletion_tasks,
    alias="sentry.deletions.overwatch_notify_organization_deleted",
    retry=Retry(times=_MAX_RETRIES, delay=_RETRY_DELAY_S, on=(HTTPError,)),
    silo_mode=SiloMode.CELL,
)
def notify_seer_organization_deleted(organization_id: int, **kwargs: Any) -> None:
    """
    Notify Seer that an organization was deleted from this Sentry region (code review offboard).
    """
    viewer_context = SeerViewerContext(organization_id=organization_id)
    make_seer_request(
        path=SeerEndpoint.ORGANIZATION_OFFBOARD.value,
        payload={"organization_id": organization_id},
        viewer_context=viewer_context,
    )
    logger.info(
        "seer.organization_deleted.success",
        extra={"organization_id": organization_id},
    )
