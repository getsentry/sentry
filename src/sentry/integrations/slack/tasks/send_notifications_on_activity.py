import logging

from django.db import router, transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

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
    try:
        activity = Activity.objects.get(pk=activity_id)
    except Activity.DoesNotExist:
        _default_logger.info("Activity does not exist", extra={"activity_id": activity_id})
        return

    organization = Organization.objects.get_from_cache(id=activity.project.organization_id)
    if features.has("organizations:slack-thread-issue-alert", organization):
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

    _default_logger.info("task completed", extra={"activity_id": activity_id})


@receiver(post_save, sender=Activity)
def activity_created_receiver(instance, created, **kwargs):
    """
    If an activity is created for an issue, this will trigger, and we can kick off an async process
    """
    if not created:
        return

    transaction.on_commit(
        lambda: send_activity_notifications_to_slack_threads.apply_async(
            kwargs={"activity_id": instance.id}
        ),
        using=router.db_for_read(Activity),
    )
