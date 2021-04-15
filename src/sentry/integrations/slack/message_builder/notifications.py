from sentry.integrations.slack.utils import LEVEL_TO_COLOR
from sentry.utils.assets import get_asset_url
from sentry.utils.http import absolute_uri


def build_notification_attachment(notification, context):
    logo_url = absolute_uri(get_asset_url("sentry", "images/sentry-email-avatar.png"))
    settings_url = absolute_uri("/settings/account/notifications/")
    activity_link = context["activity_link"]  # this has a referrer built in, change it?
    notification_category = notification.get_category()

    if notification_category == "note_activity_email":
        short_id = context["group"].qualified_short_id
        author = context["author"].get_display_name()
        title = f"New comment by {author}"
        text = context["data"]["text"]
        footer = f"<{activity_link}|{short_id}> via <{settings_url}|Notification Settings>"
    elif notification_category in [
        "assigned_activity_email",
        "resolved_activity_email",
        "unassigned_activity_email",
    ]:
        short_id = context["group"].qualified_short_id
        title = context["activity_name"]
        text = context["text_description"]
        footer = f"<{activity_link}|{short_id}> via <{settings_url}|Notification Settings>"

    return {
        "title": title,
        "text": text,
        "mrkdwn_in": ["text"],
        "footer_icon": logo_url,
        "footer": footer,
        "color": LEVEL_TO_COLOR["info"],
    }
