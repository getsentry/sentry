import re
from typing import Any, Union
from urllib.parse import urljoin

from sentry.models import Project, Team, User
from sentry.notifications.activity.base import ActivityNotification
from sentry.notifications.activity.release import ReleaseActivityNotification
from sentry.notifications.base import BaseNotification
from sentry.notifications.rules import AlertRuleNotification
from sentry.utils.http import absolute_uri


def get_referrer_qstring(notification: BaseNotification) -> str:
    return "?referrer=" + re.sub("Notification$", "Slack", notification.__class__.__name__)


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


def build_notification_footer(notification: BaseNotification, recipient: Union[Team, User]) -> Any:
    if isinstance(recipient, Team):
        team = Team.objects.get(id=recipient.id)
        url_str = f"/settings/{notification.group.project.organization.slug}/teams/{team.slug}/notifications/"
        settings_url = str(urljoin(absolute_uri(url_str), get_referrer_qstring(notification)))
    else:
        settings_url = get_settings_url(notification)

    if isinstance(notification, ReleaseActivityNotification):
        # no environment related to a deploy
        return f"{notification.release.projects.all()[0].slug} | <{settings_url}|Notification Settings>"

    footer = Project.objects.get_from_cache(id=notification.group.project_id).slug
    latest_event = notification.group.get_latest_event()
    environment = None
    if latest_event:
        environment = latest_event.get_environment()
    if environment and environment.name != "":
        footer += f" | {environment.name}"
    footer += f" | <{settings_url}|Notification Settings>"
    return footer
