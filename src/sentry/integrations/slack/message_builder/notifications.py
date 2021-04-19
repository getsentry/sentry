import re
from urllib.parse import urljoin

from sentry.integrations.slack.utils import LEVEL_TO_COLOR


def build_notification_footer(notification):
    links = notification.get_dm_links()
    notification_type = notification.__class__.__name__
    referrer = re.sub("Notification$", "Slack", notification_type)
    settings_url = urljoin(links["settings_url"], "?referrer=" + referrer)

    if notification.get_category() == "release_activity_email":
        # groups are not associated with a deploy notification
        # so in this one case, the footer is different
        return f"<{settings_url}|Notification Settings>"

    group_url = urljoin(links["group_url"], "?referrer=" + referrer)
    short_id = links["short_id"]
    return f"<{group_url}|{short_id}> via <{settings_url}|Notification Settings>"


def build_notification_attachment(notification, context):
    footer = build_notification_footer(notification)
    return {
        "title": notification.get_title(),
        "text": context["text_description"],
        "mrkdwn_in": ["text"],
        "footer_icon": notification._get_sentry_avatar_url(),
        "footer": footer,
        "color": LEVEL_TO_COLOR["info"],
    }
