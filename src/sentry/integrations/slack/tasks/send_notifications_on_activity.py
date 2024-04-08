import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from sentry import features
from sentry.integrations.slack.service import SlackService
from sentry.models.activity import Activity
from sentry.models.organization import Organization
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task

_default_logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.integrations.slack.tasks.send_activity_notifications",
    queue="integrations_slack_activity_notify",
    silo_mode=SiloMode.REGION,
)
def send_activity_notifications(activity_id):
    try:
        activity = Activity.objects.get(pk=activity_id)
    except Activity.DoesNotExist:
        _default_logger.info("Activity does not exist", extra={"activity_id": activity_id})
        return

    _default_logger.info("Sending notifications for activity", extra={"activity_id": activity_id})

    organization = Organization.objects.get_from_cache(pk=activity.project.organization_id)
    if features.has("organizations:slack-thread-issue-alert", organization):
        slack_service = SlackService.default()
        slack_service.notify_all_threads_for_activity(activity=activity)

    _default_logger.info(
        "Finished sending notifications for activity", extra={"activity_id": activity_id}
    )


@receiver(post_save, sender=Activity, weak=False)
def activity_created_receiver(instance, created, **kwargs):
    """
    If an activity is created for an issue, this will trigger, and we can kick off an async process
    """
    if not created:
        return

    send_activity_notifications.apply_async(kwargs={"activity_id": instance.id})
