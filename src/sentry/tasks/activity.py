import logging

from sentry.tasks.base import instrumented_task
from sentry.utils.safe import safe_execute

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
    name="sentry.tasks.activity.send_activity_notifications", queue="activity.notify"
)
def send_activity_notifications(activity_id):
    from sentry.models import Activity

    try:
        activity = Activity.objects.get(pk=activity_id)
    except Activity.DoesNotExist:
        return

    for notifier in get_activity_notifiers(activity.project):
        notifier.notify_about_activity(activity)
