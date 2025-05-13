from dataclasses import dataclass
from typing import Any

from sentry.integrations.slack.integration import SlackIntegration
from sentry.platform_example.notification_provider import NotificationProvider
from sentry.platform_example.notification_renderer import NotificationRenderer
from sentry.platform_example.notification_target import (
    NotificationIntegrationTargetValidator,
    NotificationTarget,
)
from sentry.platform_example.notification_types import NotificationProviderNames, NotificationType
from sentry.platform_example.registry import ProviderRegistry
from sentry.platform_example.template_base import NotificationTemplate, TemplateData


# Example Provider
class ExampleNotificationRenderer(NotificationRenderer[str]):
    """
    Example renderer that processes a template and data, returning a string.
    This is missing an abstraction though, since a renderer shouldn't have to
    concern itself with the template and raw data. This likely needs an
    intermediate representation that encapsulates individual notification
    "components", such as a Title, Text string, link, chart, etc..
    """

    def render(
        self,
        notification_content: TemplateData,
        notification_template: NotificationTemplate,
    ) -> str:
        return "Hello, World!"


class ExampleNotificationProvider(NotificationProvider[str]):
    def send_notification(
        self,
        notification_content: str,
        notification_type: NotificationType,
        target: NotificationTarget,
    ) -> None:
        # print(notification_content)
        pass

    def get_renderer(self, notification_type: NotificationType) -> NotificationRenderer[str]:
        return ExampleNotificationRenderer()

    def get_additional_data_schema(self) -> dict[str, Any] | None:
        return None


ProviderRegistry.register_provider(ExampleNotificationProvider(), "example")


# Slack Example
@dataclass
class SlackBlockKitData:
    blocks: list[dict[str, Any]]


class SlackNotificationProvider(NotificationProvider[SlackBlockKitData]):
    def send_notification(
        self,
        notification_content: SlackBlockKitData,
        notification_type: NotificationType,
        target: NotificationTarget,
    ) -> None:
        validator = NotificationIntegrationTargetValidator(target)
        validator.validate_notification_target()
        install = validator.get_integration_installation()

        assert isinstance(install, SlackIntegration)

        install.get_client().chat_postMessage(
            channel=str(target.resource_value),
            blocks=notification_content.blocks,
        )

    def get_renderer(
        self, notification_type: NotificationType
    ) -> NotificationRenderer[SlackBlockKitData]:
        return SlackNotificationRenderer()

    def get_additional_data_schema(self) -> dict[str, Any]:
        return {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "type": "object",
            "properties": {
                "meta": {
                    "type": ["string", "null"],
                    "description": "An additional string that will be appended to the notification",
                },
                "additionalProperties": False,
            },
        }


class SlackNotificationRenderer(NotificationRenderer[SlackBlockKitData]):
    def render(
        self,
        notification_content: TemplateData,
        notification_template: NotificationTemplate,
    ) -> SlackBlockKitData:

        rendered_template = notification_template.render_integration_template(notification_content)

        return SlackBlockKitData(
            blocks=[
                {
                    "type": "header",
                    "text": {"type": "plain_text", "text": rendered_template.subject},
                },
                {
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": rendered_template.body},
                },
            ],
        )


ProviderRegistry.register_provider(SlackNotificationProvider(), NotificationProviderNames.SLACK)


class EmailNotificationProvider(NotificationProvider[tuple[str, str]]):
    def send_notification(
        self,
        notification_content: tuple[str, str],
        notification_type: NotificationType,
        target: NotificationTarget,
    ) -> None:
        pass

    def get_renderer(
        self, notification_type: NotificationType
    ) -> NotificationRenderer[tuple[str, str]]:
        return EmailNotificationRenderer()

    def get_additional_data_schema(self) -> dict[str, str]:
        return {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "type": "object",
            "properties": {
                "stuff": {
                    "type": ["string", "null"],
                    "description": "An additional string that will be appended to the notification",
                },
            },
            "additionalProperties": False,
        }


class EmailNotificationRenderer(NotificationRenderer[tuple[str, str]]):
    def render(
        self,
        notification_content: TemplateData,
        notification_template: NotificationTemplate,
    ) -> tuple[str, str]:
        # Returns a tuple containing HTML and plain text content
        return ("<html><body>Hello, World!</body></html>", "Hello, World!")


ProviderRegistry.register_provider(EmailNotificationProvider(), NotificationProviderNames.EMAIL)
