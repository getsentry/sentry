import logging

from sentry.models.group import Group
from sentry.seer.supergroups.lightweight_rca_cluster import trigger_lightweight_rca_cluster
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import ingest_errors_tasks

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.seer.lightweight_rca_cluster.trigger_lightweight_rca_cluster_task",
    namespace=ingest_errors_tasks,
)
def trigger_lightweight_rca_cluster_task(group_id: int, **kwargs) -> None:
    try:
        group = Group.objects.get(id=group_id)
    except Group.DoesNotExist:
        logger.info(
            "lightweight_rca_cluster_task.group_not_found",
            extra={"group_id": group_id},
        )
        return

    try:
        trigger_lightweight_rca_cluster(group)
    except Exception:
        logger.exception(
            "lightweight_rca_cluster_task.failed",
            extra={"group_id": group_id},
        )
        raise
