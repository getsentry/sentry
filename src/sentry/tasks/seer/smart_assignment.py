import logging

from taskbroker_client.retry import Retry

from sentry.locks import locks
from sentry.models.activity import Activity
from sentry.seer.smart_assignment.models import SMART_ASSIGNMENT_ACTIVITIES
from sentry.seer.smart_assignment.trigger import trigger_smart_assignment
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks
from sentry.types.activity import ActivityType
from sentry.utils.locking import UnableToAcquireLock

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.seer.smart_assignment.process_smart_assignment_trigger",
    namespace=seer_tasks,
    processing_deadline_duration=120,
    retry=Retry(on=(UnableToAcquireLock,), times=3, delay=30),
    silo_mode=SiloMode.CELL,
)
def process_smart_assignment_trigger(*, group_id: int, activity_id: int) -> None:
    try:
        activity = Activity.objects.select_related("group").get(
            id=activity_id,
            group_id=group_id,
        )
    except Activity.DoesNotExist:
        logger.info(
            "smart_assignment.task.activity_not_found",
            extra={"group_id": group_id, "activity_id": activity_id},
        )
        return

    try:
        activity_type = ActivityType(activity.type)
    except ValueError:
        return

    if activity_type not in SMART_ASSIGNMENT_ACTIVITIES:
        return

    group = activity.group
    if group is None:
        return

    lock = locks.get(
        f"smart_assignment:trigger:{group_id}",
        duration=180,
        name="smart_assignment_trigger",
    )
    with lock.acquire():
        trigger_smart_assignment(group, activity_type, activity)
