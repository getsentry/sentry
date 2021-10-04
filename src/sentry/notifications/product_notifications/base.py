import logging

from sentry import analytics, features
from sentry.integrations.slack.client import SlackClient
from sentry.integrations.slack.notifications import get_channel_and_token_by_recipient
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils import json
from sentry.utils.email import MessageBuilder
from sentry.utils.http import absolute_uri

logger = logging.getLogger(__name__)


class InProductOrganizationNotification:
    analytics_event = None
    referrer = None

    @property
    def org_slug(self):
        return self.organization.slug

    def send_email_notification(self, recipient):
        msg = MessageBuilder(**self.get_message_builder_args(recipient))
        email = recipient.get_email()
        msg.send_async([email])

    def get_message_builder_args(self, recipient):
        raise NotImplementedError

    def get_slack_payload(self, recipient):
        return {
            "attachments": json.dumps(
                [self.get_slack_attachment(recipient)],
            )
        }

    @property
    def settings_url(notification):
        # TODO: need full URL
        url_str = "/settings/account/notifications/"
        return absolute_uri(url_str)

    def send_slack_notification(self, recipient):
        data = get_channel_and_token_by_recipient(self.organization, [recipient.user])
        tokens_by_channel = data[recipient.user]

        client = SlackClient()

        for channel, token in tokens_by_channel.items():
            # unfurl_links and unfurl_media are needed to preserve the intended message format
            # and prevent the app from replying with help text to the unfurl
            payload = {"token": token, "channel": channel, **self.get_slack_payload(recipient)}
            try:
                client.post("/chat.postMessage", data=payload, timeout=5)
            except ApiError as e:
                logger.info(
                    "notification.fail.slack_post",
                    extra={
                        "error": str(e),
                        "notification": self.__class__.__name__,
                        "recipient": recipient.id,
                        "channel_id": channel,
                    },
                )

    def send_one_notification(self, recipient):
        providers = self.get_default_providers(recipient)
        for provider in providers:
            # TODO: wrap in try/except so one error doesn'ts block the other notification
            if provider == "email":
                self.send_email_notification(recipient)
            if provider == "slack":
                self.send_slack_notification(recipient)
        self.record_notification_sent(recipient, providers)

    def send(self):
        # TODO: could use threading to parallelize requets
        recipients = self.get_recipients()
        for recipient in recipients:
            self.send_one_notification(recipient)

    def get_default_providers(self, recipient):
        # TODO: use notification settings instead of feature flag
        providers = ["email"]
        if features.has("organizations:slack-requests", self.organization):
            providers.append("slack")
        return providers

    def record_notification_sent(self, recipient, providers):
        analytics.record(
            self.analytics_event,
            organization_id=self.organization.id,
            user_id=self.requester.id,
            target_user_id=recipient.id,
            providers=providers,
        )

    @property
    def query_param(self):
        return "?referrer=" + self.referrer
