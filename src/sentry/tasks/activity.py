import logging

from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.utils.safe import safe_execute
from sentry.utils.sdk import bind_organization_context

logger = logging.getLogger(__name__)


def get_activity_notifiers(project):
    from sentry.mail import mail_adapter
    from sentry.plugins.base import plugins
    from sentry.plugins.bases.notify import NotificationPlugin

    results = []
    for plugin in plugins.for_project(project, version=1):
        if isinstance(plugin, NotificationPlugin):
            results.append(plugin)

    for plugin in plugins.for_project(project, version=2):
        for notifier in safe_execute(plugin.get_notifiers, _with_transaction=False) or ():
            results.append(notifier)

    results.append(mail_adapter)

    return results


@instrumented_task(
    name="sentry.tasks.activity.send_activity_notifications",
    queue="activity.notify",
    silo_mode=SiloMode.REGION,
)
def send_activity_notifications(activity_id):
    from sentry.models.activity import Activity
    from sentry.models.organization import Organization

    try:
        activity = Activity.objects.get(pk=activity_id)
    except Activity.DoesNotExist:
        return

    organization = Organization.objects.get_from_cache(pk=activity.project.organization_id)
    bind_organization_context(organization)

    for notifier in get_activity_notifiers(activity.project):
        notifier.notify_about_activity(activity)
