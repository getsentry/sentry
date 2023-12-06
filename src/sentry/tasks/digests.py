import logging
import time
from typing import List, Optional

from sentry.digests import Record, get_option_key
from sentry.digests.backends.base import InvalidState
from sentry.digests.notifications import build_digest, split_key
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.utils import snuba

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.digests.schedule_digests",
    queue="digests.scheduling",
    silo_mode=SiloMode.REGION,
)
def schedule_digests():
    from sentry import digests

    deadline = time.time()

    # The maximum (but hopefully not typical) expected delay can be roughly
    # calculated by adding together the schedule interval, the # of shards *
    # schedule timeout (at least until these are able to be processed in
    # parallel), the expected duration of time an item spends waiting in the
    # queue to be processed for delivery and the expected duration of time an
    # item takes to be processed for delivery, so this timeout should be
    # relatively high to avoid requeueing items before they even had a chance
    # to be processed.
    timeout = 300
    digests.maintenance(deadline - timeout)

    for entry in digests.schedule(deadline):
        deliver_digest.delay(entry.key, entry.timestamp)


@instrumented_task(
    name="sentry.tasks.digests.deliver_digest",
    queue="digests.delivery",
    silo_mode=SiloMode.REGION,
)
def deliver_digest(key, schedule_timestamp=None, notification_uuid: Optional[str] = None):
    from sentry import digests
    from sentry.mail import mail_adapter

    try:
        project, target_type, target_identifier, fallthrough_choice = split_key(key)
    except Project.DoesNotExist as error:
        logger.info("Cannot deliver digest %s due to error: %s", key, error)
        digests.delete(key)
        return

    minimum_delay = ProjectOption.objects.get_value(
        project, get_option_key("mail", "minimum_delay")
    )

    with snuba.options_override({"consistent": True}):
        try:
            with digests.digest(key, minimum_delay=minimum_delay) as records:
                digest, logs = build_digest(project, records)

                if not notification_uuid:
                    notification_uuid = get_notification_uuid_from_records(records)
        except InvalidState as error:
            logger.info("Skipped digest delivery: %s", error, exc_info=True)
            return

        if digest:
            mail_adapter.notify_digest(
                project,
                digest,
                target_type,
                target_identifier,
                fallthrough_choice=fallthrough_choice,
                notification_uuid=notification_uuid,
            )
        else:
            logger.info(
                "Skipped digest delivery due to empty digest",
                extra={
                    "project": project.id,
                    "target_type": target_type.value,
                    "target_identifier": target_identifier,
                    "build_digest_logs": logs,
                    "fallthrough_choice": fallthrough_choice.value if fallthrough_choice else None,
                },
            )


def get_notification_uuid_from_records(records: List[Record]) -> Optional[str]:
    for record in records:
        try:
            notification_uuid = record.value.notification_uuid
            if notification_uuid:  # Take the first existing notification_uuid
                return notification_uuid
        except Exception:
            return None
    return None
