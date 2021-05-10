import re
from typing import Any, Mapping
from urllib.parse import urljoin

from sentry.integrations.slack.message_builder.issues import build_group_attachment
from sentry.integrations.slack.utils import LEVEL_TO_COLOR
from sentry.notifications.base import BaseNotification
from sentry.notifications.rules import AlertRuleNotification
from sentry.notifications.utils.avatar import get_sentry_avatar_url
from sentry.utils.http import absolute_uri


def get_referrer_qstring(notification: BaseNotification) -> str:
    return "?referrer=" + re.sub("Notification$", "Slack", notification.__class__.__name__)


def get_settings_url(notification: BaseNotification) -> str:
    return urljoin(
        absolute_uri("/settings/account/notifications/"), get_referrer_qstring(notification)
    )


def get_group_url(notification: BaseNotification) -> str:
    return urljoin(notification.group.get_absolute_url(), get_referrer_qstring(notification))


def build_notification_footer(notification: BaseNotification) -> str:
    settings_url = get_settings_url(notification)

    if not notification.group:
        # Groups are not associated with a deploy notification so in this one
        # case, the footer is different.
        return f"<{settings_url}|Notification Settings>"

    group_url = get_group_url(notification)
    short_id = notification.group.qualified_short_id
    return f"<{group_url}|{short_id}> via <{settings_url}|Notification Settings>"


def build_notification_attachment(
    notification: BaseNotification, context: Mapping[str, Any]
) -> Mapping[str, str]:
    if isinstance(notification, AlertRuleNotification):
        return build_group_attachment(
            notification.group,
            notification.event,
            context["tags"],
            notification.rules,
            issue_alert=True,
        )

    footer = build_notification_footer(notification)
    return {
        "title": notification.get_title(),
        "text": context["text_description"],
        "mrkdwn_in": ["text"],
        "footer_icon": get_sentry_avatar_url(),
        "footer": footer,
        "color": LEVEL_TO_COLOR["info"],
    }
