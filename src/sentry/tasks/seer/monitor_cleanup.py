import logging

from django.utils import timezone

from sentry.seer.models.run import SeerAgentRun
from sentry.seer.monitor_cleanup import FEATURE_ID, runs
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks

logger = logging.getLogger(__name__)


def schedule_timeout(run_id: int, organization_id: int) -> None:
    try:
        expire_run.apply_async(
            args=[run_id, organization_id], countdown=int(runs.RUN_TIMEOUT.total_seconds())
        )
    except Exception:
        logger.exception("monitor_cleanup.timeout_enqueue_failed", extra={"run_id": run_id})
        runs.finish_run(
            run_id,
            organization_id=organization_id,
            error="Could not schedule this scan's timeout. Start a new run to try again.",
        )


@instrumented_task(
    name="sentry.tasks.seer.monitor_cleanup.expire_run",
    namespace=seer_tasks,
    processing_deadline_duration=30,
)
def expire_run(run_id: int, organization_id: int) -> None:
    agent_run = SeerAgentRun.objects.filter(
        run_id=run_id,
        run__organization_id=organization_id,
        source=FEATURE_ID,
        extras__status="running",
        run__date_added__lte=timezone.now() - runs.RUN_TIMEOUT,
    ).first()
    if agent_run is not None:
        runs.finish_run(
            run_id,
            organization_id=organization_id,
            error="The scan timed out. Start a new run to try again.",
        )
