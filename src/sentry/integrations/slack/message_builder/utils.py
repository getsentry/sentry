import re
from urllib.parse import urljoin

from sentry.models import Project
from sentry.notifications.activity import ReleaseActivityNotification
from sentry.notifications.activity.base import ActivityNotification
from sentry.notifications.base import BaseNotification
from sentry.notifications.rules import AlertRuleNotification
from sentry.utils.http import absolute_uri


def get_referrer_qstring(notification: BaseNotification) -> str:
    return "?referrer=" + re.sub("Notification$", "Slack", notification.__class__.__name__)


def build_notification_footer(notification: BaseNotification) -> str:
    settings_url = get_settings_url(notification)
    if isinstance(notification, ReleaseActivityNotification):
        # temp while I figure out what to put here for deploys
        return f"<{settings_url}|Notification Settings>"

    project = Project.objects.get_from_cache(id=notification.group.project_id)
    return f"{project.slug} | <{settings_url}|Notification Settings>"


def get_settings_url(notification: BaseNotification) -> str:
    if isinstance(notification, ReleaseActivityNotification):
        fine_tuning = "deploy/"
    elif isinstance(notification, ActivityNotification):
        fine_tuning = "workflow/"
    elif isinstance(notification, AlertRuleNotification):
        fine_tuning = "alerts/"
    else:
        fine_tuning = ""

    url_str = f"/settings/account/notifications/{fine_tuning}"
    return str(urljoin(absolute_uri(url_str), get_referrer_qstring(notification)))
