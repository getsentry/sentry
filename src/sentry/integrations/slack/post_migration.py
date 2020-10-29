from __future__ import absolute_import

import six
import logging

from sentry.shared_integrations.exceptions import ApiError
from sentry.models import Integration, User, Organization
from sentry.utils import json, email
from sentry.tasks.base import instrumented_task, retry

from .client import SlackClient

logger = logging.getLogger(__name__)


doc_link = "https://docs.sentry.io/product/integrations/slack/#upgrading-slack"


def build_migration_attachment():
    return {
        "title": "Action required",
        "text": "Your Sentry Slack Integration is upgraded and nearly ready to report errors. Mention @sentry to get notifications in this channel (the one with the pink logo, not Sentry Legacy). To learn more, <%s|see our documentation>."
        % (doc_link),
        "footer": "Sentry API",
        "footer_icon": "https://sentryio-assets.storage.googleapis.com/img/slack/integration-avatar.png",
    }


@instrumented_task(
    name="sentry.integrations.slack.run_post_migration", queue="integrations",
)
@retry(on=())  # no retries on any errors
def run_post_migration(
    integration_id, organization_id, user_id, private_channels, missing_channels
):

    integration = Integration.objects.get(id=integration_id)
    organization = Organization.objects.get(id=organization_id)
    user = User.objects.get(id=user_id)

    client = SlackClient()

    failing_channels = []
    good_channels = []
    for channel in private_channels:
        attachment = build_migration_attachment()
        channel_name = channel["name"]
        channel_id = channel["id"]
        payload = {
            "channel": channel_id,
            "link_names": 1,
            "attachments": json.dumps([attachment]),
        }
        headers = {
            "Authorization": "Bearer %s" % (six.text_type(integration.metadata["old_access_token"]))
        }
        try:
            client.post("/chat.postMessage", data=payload, headers=headers, timeout=5, json=True)
            good_channels.append(channel)
        except ApiError as e:
            logger.error(
                "slack.post_migration.response_error",
                extra={
                    "error": six.text_type(e),
                    "channel_id": channel_id,
                    "channel_name": channel_name,
                    "integration_id": integration_id,
                    "organization_id": organization_id,
                    "integration_name": integration.name,
                    "organization_slug": organization.slug,
                },
            )
            failing_channels.append(channel)

    message = email.MessageBuilder(
        subject=u"Your Slack Sentry Integration has been upgraded",
        template="sentry/emails/slack-migration.txt",
        html_template="sentry/emails/slack-migration.html",
        type="slack_migration.summary",
        context={
            "good_channels": good_channels,
            "failing_channels": failing_channels,
            "missing_channels": missing_channels,
            "doc_link": doc_link,
            "integration": integration,
            "organization": organization,
        },
    )
    message.send([user.email])
    # delete the old access token at the end
    del integration.metadata["old_access_token"]
    integration.save()
