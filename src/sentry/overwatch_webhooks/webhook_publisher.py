import logging

from google.auth.exceptions import GoogleAuthError
from google.cloud.pubsub import PublisherClient

from sentry.overwatch_webhooks.models import WebhookDetails
from sentry.types.region import Region

logger = logging.getLogger("sentry.overwatch_webhooks")


class OverwatchWebhookPublisher:
    _publisher_client: PublisherClient
    _region: Region
    _integration_provider: str

    def __init__(self, integration_provider: str, region: Region):
        """
        This is pulled from our analytics pubsub logic. This ensures we noop
        if we don't have a valid configuration for pubsub.
        """
        self._integration_provider = integration_provider
        self._region = region
        try:
            # TODO: Validate that the publisher client version is correct.

            # TODO: Enable per-region publisher client initialization. Ideally,
            # we should have a publisher client for each region for data isolation.
            self._publisher_client = PublisherClient()
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
        return f"overwatch.{self._region.name}.{self._integration_provider}.webhooks"
