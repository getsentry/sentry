from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.sentry_app_webhook_disabled import (
    SentryAppWebhookDisabled,
    SentryAppWebhookDisabledTemplate,
)
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationRenderedTemplate,
    NotificationSource,
)
from sentry.testutils.cases import TestCase


class SentryAppWebhookDisabledTest(TestCase):
    def test_data_source(self) -> None:
        data = SentryAppWebhookDisabled(
            sentry_app_slug="my-app",
            sentry_app_name="My App",
            webhook_url="https://example.com/webhook",
            settings_url="https://sentry.io/settings/my-org/developer-settings/my-app/",
        )
        assert data.source == NotificationSource.SENTRY_APP_WEBHOOK_DISABLED

    def test_template_registered(self) -> None:
        assert template_registry.get(NotificationSource.SENTRY_APP_WEBHOOK_DISABLED) is (
            SentryAppWebhookDisabledTemplate
        )

    def test_render(self) -> None:
        template = SentryAppWebhookDisabledTemplate()
        data = SentryAppWebhookDisabled(
            sentry_app_slug="my-app",
            sentry_app_name="My App",
            webhook_url="https://example.com/webhook",
            settings_url="https://sentry.io/settings/my-org/developer-settings/my-app/",
        )

        result = template.render(data)

        assert isinstance(result, NotificationRenderedTemplate)
        assert result.subject == "Webhook delivery paused for My App"
        assert len(result.body) == 1
        assert len(result.actions) == 1
        assert result.actions[0].label == "View Integration"
        assert result.actions[0].link == data.settings_url

    def test_render_example(self) -> None:
        template = SentryAppWebhookDisabledTemplate()
        rendered = template.render_example()

        assert isinstance(rendered, NotificationRenderedTemplate)
        assert "Example App" in rendered.subject

    def test_category(self) -> None:
        assert SentryAppWebhookDisabledTemplate.category == NotificationCategory.SENTRY_APP
