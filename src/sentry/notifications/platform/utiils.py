from sentry.notifications.platform.provider import NotificationProviderError
from sentry.notifications.platform.target import IntegrationNotificationTarget


def validate_integration_for_target(target: IntegrationNotificationTarget) -> None:
    if not hasattr(target, "integration"):
        raise NotificationProviderError(
            f"Integration with id '{target.integration_id}' was not prepared for target"
        )

    if not hasattr(target, "organization_integration"):
        raise NotificationProviderError(
            f"Organization integration for integration, '{target.integration_id}' and organization, '{target.organization_id}' was not prepared for target"
        )
