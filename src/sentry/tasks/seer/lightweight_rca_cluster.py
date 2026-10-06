import contextlib
import logging

from sentry.models.group import Group
from sentry.seer.supergroups.lightweight_rca_cluster import trigger_lightweight_rca_cluster
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import ingest_errors_postprocess_tasks, ingest_errors_tasks
from sentry.viewer_context import (
    ActorType,
    ViewerContext,
    get_viewer_context,
    set_viewer_context_project,
    viewer_context_scope,
)

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.seer.lightweight_rca_cluster.trigger_lightweight_rca_cluster_task",
    namespace=ingest_errors_postprocess_tasks,
    alias_namespace=ingest_errors_tasks,
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

    scope: contextlib.AbstractContextManager[None] = contextlib.nullcontext()
    if get_viewer_context() is None:
        scope = viewer_context_scope(
            ViewerContext(
                organization_id=group.organization.id,
                project_id=group.project_id,
                actor_type=ActorType.SYSTEM,
            )
        )
    else:
        set_viewer_context_project(group.project_id)

    with scope:
        try:
            trigger_lightweight_rca_cluster(group)
        except Exception:
            logger.exception(
                "lightweight_rca_cluster_task.failed",
                extra={"group_id": group_id},
            )
            raise
