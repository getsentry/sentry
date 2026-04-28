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
    name="sentry.deletions.seer_notify_repository_deleted",
    namespace=deletion_tasks,
    retry=Retry(times=_MAX_RETRIES, delay=_RETRY_DELAY_S, on=(HTTPError,)),
    silo_mode=SiloMode.CELL,
)
def notify_seer_repository_deleted(
    organization_id: int,
    repository_id: int,
    provider: str | None,
    repository_name: str,
    **kwargs: Any,
) -> None:
    """
    Notify Seer that a repository was deleted from this Sentry region (code review offboard).

    ``repository_name`` is the full repo identifier stored on ``Repository.name`` (e.g. ``owner/repo``).
    """
    viewer_context = SeerViewerContext(organization_id=organization_id)
    make_seer_request(
        path=SeerEndpoint.REPOSITORY_OFFBOARD.value,
        payload={
            "organization_id": organization_id,
            "repository_id": repository_id,
            "provider": provider,
            "repository_name": repository_name,
        },
        viewer_context=viewer_context,
    )
    logger.info(
        "seer.repository_deleted.success",
        extra={
            "organization_id": organization_id,
            "repository_id": repository_id,
            "provider": provider,
            "repository_name": repository_name,
        },
    )
