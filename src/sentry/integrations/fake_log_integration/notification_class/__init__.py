from collections.abc import Iterable, Mapping, MutableMapping
from typing import Any

from sentry.integrations.fake_log_integration.log_provider import FakeIntegrationClient
from sentry.integrations.services.integration.service import integration_service
from sentry.integrations.types import ExternalProviders
from sentry.models.organization import Organization
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
    integration = integration_service.get_integration(
        organization_id=notification.organization.id,
        provider="fake-log",
    )

    if integration is None:
        raise ValueError("No integration found for organization")

    for recipient in recipients:
        FakeIntegrationClient(integration).log(
            notification.get_notification_title(
                provider=ExternalProviders.FAKE_LOG, context=shared_context
            ),
            shared_context["target_identifier"],
            notification.notification_uuid,
        )


class LoggingNotification(BaseNotification):
    def __init__(self, organization: Organization, target_recipient: Actor, target_identifier: str):
        super().__init__(organization=organization)
        self.target_identifier = target_identifier
        # Passing the recipient here is just for convenience, other notification
        # classes construct a list of recipients from the target org based
        # on notification settings per user.
        self.target_recipient = target_recipient

    def get_notification_providers(self) -> Iterable[ExternalProviders]:
        # Restricts this notification to only use the `FAKE_LOG` provider
        return [ExternalProviders.FAKE_LOG]

    def get_context(self) -> MutableMapping[str, Any]:
        context = super().get_context()
        context["target_identifier"] = self.target_identifier
        return context

    @property
    def template_path(self) -> str:
        return "sentry/emails/generic"

    @property
    def metrics_key(self) -> str:
        return "integrations.notif_class.fake_log"

    def get_notification_title(
        self, provider: ExternalProviders, context: Mapping[str, Any] | None = None
    ) -> str:
        return "FakeLog Title"

    def get_participants(self) -> Mapping[ExternalProviders, Iterable[Actor]]:
        return {
            ExternalProviders.FAKE_LOG: [self.target_recipient],
        }

    def send(self):
        super().send()

        # This is typically where we do extra logic, like additional analytics
        # or metrics gathering
        pass
