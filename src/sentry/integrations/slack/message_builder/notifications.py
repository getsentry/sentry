from sentry.integrations.slack.utils import LEVEL_TO_COLOR


def build_notification_attachment(notification):
    return {
        "title": notification.get_dm_title(),
        "text": notification.get_dm_text(),
        "mrkdwn_in": ["text"],
        "footer_icon": notification._get_sentry_avatar_url(),
        "footer": notification.get_dm_footer(),
        "color": LEVEL_TO_COLOR["info"],
    }
