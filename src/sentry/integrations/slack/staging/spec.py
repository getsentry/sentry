from __future__ import annotations

from sentry.integrations.base import IntegrationProvider
from sentry.integrations.slack.spec import SlackMessagingSpec
from sentry.integrations.types import IntegrationProviderSlug
from sentry.notifications.models.notificationaction import ActionService
from sentry.rules.actions import IntegrationEventAction


class SlackStagingMessagingSpec(SlackMessagingSpec):
    @property
    def provider_slug(self) -> str:
        return IntegrationProviderSlug.SLACK_STAGING.value

    @property
    def action_service(self) -> ActionService:
        return ActionService.SLACK_STAGING

    @property
    def integration_provider(self) -> type[IntegrationProvider]:
        from sentry.integrations.slack.staging.integration import SlackStagingIntegrationProvider

        return SlackStagingIntegrationProvider

    @property
    def notify_service_action(self) -> type[IntegrationEventAction] | None:
        from sentry.integrations.slack.staging.notification import (
            SlackStagingNotifyServiceAction,
        )

        return SlackStagingNotifyServiceAction
