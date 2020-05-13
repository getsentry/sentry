from __future__ import absolute_import

import six
import logging

from sentry.shared_integrations.exceptions import ApiError
from sentry.models import Integration, User, Organization
from sentry.utils import json
from sentry.utils.email import MessageBuilder
from sentry.tasks.base import instrumented_task, retry

from .client import SlackClient

logger = logging.getLogger(__name__)


doc_link = "https://docs.sentry.io/workflow/integrations/global-integrations/#slack"


def build_migration_attachment():
    return {
        "title": "Action required",
        "text": "Your Sentry Slack Integration has been upgraded. Mention `@sentry` to receive Sentry notifications in this channel. For more information, <%s|check out the documentation>."
        % (doc_link),
        "footer": "Sentry API",
        "footer_icon": "https://sentryio-assets.storage.googleapis.com/img/slack/integration-avatar.png",
    }


@instrumented_task(
    name="sentry.integrations.slack.run_post_migration", queue="integrations",
)
@retry(on=())  # no retries on any errors
def run_post_migration(integration_id, organization_id, user_id, channels):
    integration = Integration.objects.get(id=integration_id)
    organization = Organization.objects.get(id=organization_id)
    user = User.objects.get(id=user_id)

    client = SlackClient()

    problem_channels = []
    good_channels = []
    for channel in channels:
        attachment = build_migration_attachment()
        channel_name = channel["name"]
        channel_id = channel["id"]
        payload = {
            "token": integration.metadata["old_access_token"],
            "channel": channel_id,
            "link_names": 1,
            "attachments": json.dumps([attachment]),
        }
        try:
            client.post("/chat.postMessage", data=payload, timeout=5)
            good_channels.append(channel_name)
        except ApiError as e:
            logger.error(
                "slack.post_migration.response_error",
                extra={
                    "error": six.text_type(e),
                    "channel_id": channel_id,
                    "channel_name": channel_name,
                    "integration_id": integration_id,
                    "organization_id": organization_id,
                },
            )
            problem_channels.append(channel_name)

    message = MessageBuilder(
        subject=u"Your Slack Sentry Integration has been upgraded",
        template="sentry/emails/slack-migration.txt",
        html_template="sentry/emails/slack-migration.html",
        type="slack_migration.summary",
        context={
            "good_channels": good_channels,
            "problem_channels": problem_channels,
            "doc_link": doc_link,
            "integration": integration,
            "organization": organization,
        },
    )
    message.send([user.email])
