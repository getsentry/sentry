from collections.abc import Iterable, Mapping
from typing import Any

from sentry.integrations.fake_log_integration.log_provider import FakeIntegrationClient
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration.service import integration_service
from sentry.integrations.types import ExternalProviders
from sentry.notifications.notifications.base import BaseNotification
from sentry.notifications.notify import register_notification_provider
from sentry.types.actor import Actor
from sentry.users.models.user import User


@register_notification_provider(ExternalProviders.FAKE_LOG)
def send_notification_as_fake_log(
    notification: BaseNotification,
    recipients: Iterable[Actor | User],
    shared_context: Mapping[str, Any],
    extra_context_by_actor: Mapping[Actor, Mapping[str, Any]] | None,
) -> None:
    # Many of our integrations will query per-recipient provider information.
    # This would be things like a user ID for Slack, or Team channel depending on
    # the recipient type provided.
    #
    # We don't have any of this for our sample integration, so we'll just fan out
    # per organization integration x recipient.
    integrations = integration_service.get_integration(
        organization_id=notification.organization.id,
        provider=ExternalProviders.FAKE_LOG,
    )

    if integrations is None:
        raise ValueError("No integration found for organization")

    for integration in integrations:
        FakeIntegrationClient(integration).log(
            notification.title, notification.target_identifier, notification.uuid
        )


class LoggingNotification(BaseNotification):
    def __init__(self, integration: Integration, target_identifier: str):
        self.integration = integration
        self.target_identifier = target_identifier

    def send(self):
        pass
