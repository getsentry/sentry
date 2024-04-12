import logging

from django.db import router, transaction

from sentry import features
from sentry.integrations.slack.service import SlackService
from sentry.models.activity import Activity
from sentry.models.organization import Organization
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics

_default_logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.integrations.slack.tasks.send_activity_notifications_to_slack_threads",
    queue="integrations_slack_activity_notify",
    silo_mode=SiloMode.REGION,
)
def send_activity_notifications_to_slack_threads(activity_id) -> None:
    log_params = {"activity_id": activity_id}
    _default_logger.info("async processing for activity", extra=log_params)

    try:
        activity = Activity.objects.get(pk=activity_id)
    except Activity.DoesNotExist:
        _default_logger.info("activity does not exist", extra=log_params)
        return

    organization = Organization.objects.get_from_cache(id=activity.project.organization_id)
    log_params["organization_id"] = organization.id

    org_has_flag = features.has("organizations:slack-thread-issue-alert", organization)
    log_params["org_has_flag"] = org_has_flag
    if not org_has_flag:
        _default_logger.info("org does not have flag, skipping", extra=log_params)
        return

    _default_logger.info("attempting to send notifications", extra=log_params)
    slack_service = SlackService.default()
    try:
        slack_service.notify_all_threads_for_activity(activity=activity)
        metrics.incr(
            "sentry.integrations.slack.tasks.send_notifications_on_activity.send_activity_notifications.success",
            sample_rate=1.0,
        )
    except Exception as err:
        _default_logger.info(
            "Failed to send notifications for activity",
            exc_info=err,
            extra={"activity_id": activity_id},
        )
        metrics.incr(
            "sentry.integrations.slack.tasks.send_notifications_on_activity.send_activity_notifications.failure",
            sample_rate=1.0,
        )

    _default_logger.info("task finished for sending notifications", extra=log_params)


def activity_created_receiver(instance, created, **kwargs) -> None:
    """
    If an activity is created for an issue, this will trigger, and we can kick off an async process
    """
    log_params = {"activity_id": instance.id, "created": created}
    _default_logger.info("receiver for activity event", extra=log_params)
    if not created:
        _default_logger.info("instance is not created, skipping post processing", extra=log_params)
        return

    transaction.on_commit(
        lambda: send_activity_notifications_to_slack_threads.apply_async(
            kwargs={"activity_id": instance.id}
        ),
        using=router.db_for_read(Activity),
    )
