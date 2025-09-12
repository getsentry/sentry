import logging

from google.auth.exceptions import GoogleAuthError
from google.cloud.pubsub import PublisherClient

from sentry.overwatch_webhooks.models import WebhookDetails

logger = logging.getLogger("sentry.overwatch_webhooks")


class OverwatchWebhookPublisher:
    _publisher_client: PublisherClient

    def __init__(self, integration_provider: str):
        """
        This is pulled from our analytics pubsub logic. This ensures we noop
        if we don't have a valid configuration for pubsub.
        """
        try:
            # TODO: Validate that the publisher client version is correct.
            # TODO: Validate that the default credentials we're using for GCP work for in this context as well.
            self._publisher_client = PublisherClient()
            self._integration_provider = integration_provider
        except GoogleAuthError:
            logger.warning("webhook_dispatcher.publisher_client.missing_auth")
            self._publisher_client = None

    def enqueue_webhook(self, webhook_details: WebhookDetails):
        if self._publisher_client is None:
            logger.warning("webhook_dispatcher.publisher_client.noop")
            return

        # TODO: Validate that this data is in the format overwatch requires.
        # TODO: Validate the topic name, and maybe add integration scoping for future expansion.
        json_bytes = webhook_details.to_json().encode("utf-8")
        self._publisher_client.publish(self._get_topic_name(), json_bytes)

    def _get_topic_name(self) -> str:
        return f"sentry.overwatch.{self._integration_provider}.webhooks"
