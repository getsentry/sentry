from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.types import (
    CodeTextBlock,
    NotificationCategory,
    NotificationData,
    NotificationRenderedAction,
    NotificationRenderedTemplate,
    NotificationSource,
    NotificationTemplate,
    ParagraphBlock,
    PlainTextBlock,
)


class SentryAppWebhookDisabled(NotificationData):
    source: NotificationSource = NotificationSource.SENTRY_APP_WEBHOOK_DISABLED
    sentry_app_slug: str
    sentry_app_name: str
    webhook_url: str
    settings_url: str


@template_registry.register(NotificationSource.SENTRY_APP_WEBHOOK_DISABLED)
class SentryAppWebhookDisabledTemplate(NotificationTemplate[SentryAppWebhookDisabled]):
    category = NotificationCategory.SENTRY_APP
    example_data = SentryAppWebhookDisabled(
        sentry_app_slug="example-app",
        sentry_app_name="Example App",
        webhook_url="https://example.com/webhook",
        settings_url="https://sentry.io/settings/example-org/developer-settings/example-app/",
    )

    def render(self, data: SentryAppWebhookDisabled) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject=f"Webhook delivery paused for {data.sentry_app_name}",
            body=[
                ParagraphBlock(
                    blocks=[
                        PlainTextBlock(text="We're temporarily pausing webhook deliveries to "),
                        CodeTextBlock(text=data.webhook_url),
                        PlainTextBlock(
                            text=(
                                f" because too many recent requests to {data.sentry_app_name} have failed."
                            )
                        ),
                    ]
                ),
            ],
            actions=[
                NotificationRenderedAction(
                    label="View Integration",
                    link=data.settings_url,
                )
            ],
        )
