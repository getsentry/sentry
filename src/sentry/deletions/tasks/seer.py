import logging
from typing import Any

from sentry.seer.signed_seer_api import SeerViewerContext
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import deletion_tasks

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.deletions.seer_notify_repository_deleted",
    namespace=deletion_tasks,
    max_retries=3,
    default_retry_delay=60,
)
def notify_seer_repository_deleted(
    organization_id: int,
    repository_id: int,
    provider: str | None,
    repository_name: str,
    **kwargs: Any,
) -> None:
    """
    Notify Seer that a repository was deleted from this Sentry region.
    """
    # imported here to avoid circular imports
    from sentry.seer.code_review.utils import SeerEndpoint, make_seer_request

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
        "seer.forward_repository_delete.success",
        extra={
            "organization_id": organization_id,
            "repository_id": repository_id,
            "provider": provider,
            "repository_name": repository_name,
        },
    )
